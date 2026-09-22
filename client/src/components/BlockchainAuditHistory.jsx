import { useState } from 'react';

import EmptyState from './ui/EmptyState';
import ErrorState from './ui/ErrorState';
import LoadingState from './ui/LoadingState';
import useBlockchainHistory from '../hooks/useBlockchainHistory';
import { getMilestoneBlockchainHistory } from '../services/milestone.service';

// GovChain — Stage 2.4 · blockchain audit history.
//
// Renders the records the backend reads out of the GovChain contract event logs.
// Everything shown here is chain data: the event name, the identifiers, the actor
// address, the block timestamp, the transaction hash and the block/log position.
// The GovChain user shown next to an actor address is only an off-chain label the
// backend attaches by transaction hash (it is '—' when unknown).
//
// The component is presentational: the caller passes history/loading/error, so it
// can be reused for a project-wide trail, a single tender or a single milestone.

const EVENT_TONES = {
  ProjectCreated: 'tone-blue',
  ProjectUpdated: 'tone-slate',
  TenderCreated: 'tone-indigo',
  TenderAssigned: 'tone-indigo',
  MilestoneCreated: 'tone-blue',
  MilestoneSubmitted: 'tone-amber',
  MilestoneVerified: 'tone-green',
  MilestoneRejected: 'tone-red',
};

const ENTITY_LABELS = {
  project: 'Project',
  tender: 'Tender',
  milestone: 'Milestone',
};

const ROLE_LABELS = {
  government_officer: 'Government Officer',
  contractor: 'Contractor',
  auditor: 'Auditor',
};

// 0x83af…91bc — the full value stays available through Show / Copy.
function truncate(value, head = 10, tail = 6) {
  if (typeof value !== 'string' || !value) {
    return '—';
  }
  if (value.length <= head + tail + 1) {
    return value;
  }
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

// The blockchain timestamp is the block timestamp the contract emitted (unix
// seconds) — never a PostgreSQL created_at value.
function formatChainTime(record) {
  const seconds = Number(record.timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '—';
  }

  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;
}

function entityLabel(record) {
  const name = ENTITY_LABELS[record.entityType] || 'Record';
  return `${name} #${record.entityId}`;
}

// A blockchain value (transaction hash or actor address): truncated by default,
// copyable, and expandable so the full value stays readable.
function HashValue({ value }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <span className="text-gray-400">—</span>;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be blocked; the value is still shown on screen.
      setCopied(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <code
        className="text-xs bg-slate-50 border rounded px-1.5 py-0.5 break-all"
        title={value}
      >
        {expanded ? value : truncate(value)}
      </code>
      <button
        type="button"
        className="gc-btn gc-btn-outline gc-btn-sm"
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? 'Hide' : 'Show'}
      </button>
      <button type="button" className="gc-btn gc-btn-outline gc-btn-sm" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

// One audit record — exactly the fields the backend read out of the event log.
function AuditRow({ record }) {
  const tone = EVENT_TONES[record.event] || 'tone-slate';

  return (
    <li className="border border-gray-200 rounded-md p-3 gc-animate-entrance">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`gc-badge ${tone}`}>{record.event}</span>
          <span className="text-xs text-gray-500">{entityLabel(record)}</span>
          {record.reference && (
            <span className="text-xs text-gray-500">· reference {record.reference}</span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          Block {record.blockNumber}
          {record.transactionIndex !== null && record.transactionIndex !== undefined
            ? ` · tx #${record.transactionIndex}`
            : ''}
          {record.logIndex !== null && record.logIndex !== undefined
            ? ` · log #${record.logIndex}`
            : ''}
        </span>
      </div>

      <dl className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="gc-eyebrow">Actor address</dt>
          <dd className="mt-0.5">
            <HashValue value={record.actor} />
          </dd>
        </div>
        <div>
          <dt className="gc-eyebrow">Blockchain time</dt>
          <dd className="mt-0.5">{formatChainTime(record)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="gc-eyebrow">Transaction hash</dt>
          <dd className="mt-0.5">
            <HashValue value={record.transactionHash} />
          </dd>
        </div>
        <div>
          <dt className="gc-eyebrow">GovChain user</dt>
          <dd className="mt-0.5">
            {record.actorUser
              ? `${record.actorUser.name || 'User'} (${
                  ROLE_LABELS[record.actorUser.role] || record.actorUser.role
                })`
              : '—'}
          </dd>
        </div>
        {record.contractorId ? (
          <div>
            <dt className="gc-eyebrow">Contractor (GovChain id)</dt>
            <dd className="mt-0.5">#{record.contractorId}</dd>
          </div>
        ) : null}
      </dl>
    </li>
  );
}

export default function BlockchainAuditHistory({
  history,
  meta,
  loading,
  error,
  onRetry,
  title = 'Blockchain audit history',
  hint,
}) {
  const count = history ? history.length : null;

  return (
    <div className="gc-panel gc-animate-entrance gc-stagger-1">
      <div className="gc-panel-head">
        <span className="font-semibold">{title}</span>
        <div className="flex items-center gap-2">
          {count !== null && (
            <span className="text-xs text-gray-500">
              {count} on-chain event{count === 1 ? '' : 's'}
            </span>
          )}
          {onRetry && (
            <button
              type="button"
              className="gc-btn gc-btn-outline gc-btn-sm"
              onClick={onRetry}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      <div className="gc-panel-body">
        {hint && <p className="text-xs text-gray-500 mb-3">{hint}</p>}

        {loading && !history ? (
          <LoadingState rows={4} cols={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : !history || history.length === 0 ? (
          <EmptyState
            title="No blockchain events yet"
            hint="Events appear here as soon as a GovChain action was recorded on the local EVM chain."
          />
        ) : (
          <ol className="space-y-3">
            {history.map((record) => (
              <AuditRow
                key={`${record.transactionHash}-${record.logIndex}`}
                record={record}
              />
            ))}
          </ol>
        )}

        <hr className="gc-divider" />
        <p className="text-xs text-gray-500">
          Read from the GovChain contract event logs on the local Hardhat EVM chain
          {meta?.contractAddress ? (
            <>
              {' '}
              at <code className="break-all">{meta.contractAddress}</code>
            </>
          ) : null}
          {meta?.chainId ? ` (chain ${meta.chainId})` : ''}
          {meta?.fromBlock !== undefined && meta?.toBlock !== undefined
            ? ` · blocks ${meta.fromBlock}–${meta.toBlock}`
            : ''}
          . Order follows the chain (block → transaction → log). The actor address is the
          backend recording account that submitted the transaction; the GovChain user is the
          off-chain reference the backend keeps for the same transaction hash. Timestamps are the
          block timestamps emitted by the contract, not PostgreSQL record times.
        </p>
      </div>
    </div>
  );
}

// Self-loading variant: used inside an expanded milestone, so the chain is only
// queried for the milestone the user actually opened.
export function MilestoneBlockchainHistory({ milestoneId }) {
  const { history, meta, loading, error, refresh } = useBlockchainHistory(
    getMilestoneBlockchainHistory,
    milestoneId
  );

  return (
    <BlockchainAuditHistory
      history={history}
      meta={meta}
      loading={loading}
      error={error}
      onRetry={refresh}
      title="Milestone blockchain history"
      hint="Created / submitted / verified / rejected, as emitted by the GovChain contract."
    />
  );
}
