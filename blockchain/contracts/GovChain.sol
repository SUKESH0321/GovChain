// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GovChain
/// @notice Audit/event foundation for the GovChain government project lifecycle.
/// @dev Stages 2.1/2.2 keep this contract intentionally minimal: it only records the
/// GovChain lifecycle actions as events so that they end up in the blockchain
/// audit trail. There is no storage, no token, no payment transfer, no
/// upgradeability and no access-control logic - those belong to later stages.
/// Off-chain business data (PostgreSQL) stays off-chain and is referenced here
/// by its numeric identifier only. Every event carries msg.sender as the on-chain
/// actor and block.timestamp as the recording time.
contract GovChain {
    /// @notice Name and version of this contract, useful to verify a deployment.
    string private constant _VERSION = "GovChain/2.2.0";

    // ---------------------------------------------------------------------
    // Events (the audit trail)
    //
    // `indexed` is used for the identifiers that later modules are expected to
    // filter on. Solidity allows at most three indexed parameters per event, so
    // where a counterparty participates (TenderAssigned / PaymentReleased) the
    // counterparty is indexed instead of the actor address, because it is the
    // more useful filter. TenderAssigned identifies the contractor by its
    // off-chain GovChain user id (uint256): contractors do not have a wallet in
    // Stage 2.2, and off-chain personal data must never be written on-chain.
    // ---------------------------------------------------------------------

    /// @notice Emitted when a government project is created.
    event ProjectCreated(
        uint256 indexed projectId,
        string projectReference,
        address indexed actor,
        uint256 timestamp
    );

    /// @notice Emitted when an existing government project is updated.
    event ProjectUpdated(
        uint256 indexed projectId,
        string projectReference,
        address indexed actor,
        uint256 timestamp
    );

    /// @notice Emitted when a tender/contract is created for a project.
    event TenderCreated(
        uint256 indexed tenderId,
        uint256 indexed projectId,
        string tenderReference,
        address indexed actor,
        uint256 timestamp
    );

    /// @notice Emitted when a contractor is assigned to a tender.
    event TenderAssigned(
        uint256 indexed tenderId,
        uint256 indexed projectId,
        uint256 indexed contractorId,
        address actor,
        uint256 timestamp
    );

    /// @notice Emitted when a milestone is created for a project.
    event MilestoneCreated(
        uint256 indexed milestoneId,
        uint256 indexed projectId,
        string title,
        address indexed actor,
        uint256 timestamp
    );

    /// @notice Emitted when a milestone is submitted for verification.
    event MilestoneSubmitted(
        uint256 indexed milestoneId,
        uint256 indexed projectId,
        address indexed actor,
        uint256 timestamp
    );

    /// @notice Emitted when a submitted milestone is verified.
    event MilestoneVerified(
        uint256 indexed milestoneId,
        uint256 indexed projectId,
        address indexed actor,
        uint256 timestamp
    );

    /// @notice Emitted when a submitted milestone is rejected.
    event MilestoneRejected(
        uint256 indexed milestoneId,
        uint256 indexed projectId,
        string reason,
        address indexed actor,
        uint256 timestamp
    );

    /// @notice Emitted when a payment for a project is authorized.
    event PaymentAuthorized(
        uint256 indexed paymentId,
        uint256 indexed projectId,
        uint256 amount,
        address indexed actor,
        uint256 timestamp
    );

    /// @notice Emitted when an authorized payment is released to a recipient.
    event PaymentReleased(
        uint256 indexed paymentId,
        uint256 indexed projectId,
        uint256 amount,
        address indexed recipient,
        address actor,
        uint256 timestamp
    );

    // ---------------------------------------------------------------------
    // Event recorders
    //
    // Every function below is a thin, externally callable recorder: it accepts
    // the identifiers produced by the off-chain GovChain backend, uses
    // msg.sender as the actor, stamps block.timestamp and emits the matching
    // event. No authorization, state or transfers are implemented on purpose -
    // later stages decide who is allowed to call these functions and when.
    // ---------------------------------------------------------------------

    /// @notice Records that a project was created.
    /// @param projectId Off-chain project identifier.
    /// @param projectReference Human readable project reference/code.
    function recordProjectCreated(
        uint256 projectId,
        string calldata projectReference
    ) external {
        emit ProjectCreated(
            projectId,
            projectReference,
            msg.sender,
            block.timestamp
        );
    }

    /// @notice Records that an existing project was updated.
    /// @param projectId Off-chain project identifier.
    /// @param projectReference Human readable project reference/code.
    function recordProjectUpdated(
        uint256 projectId,
        string calldata projectReference
    ) external {
        emit ProjectUpdated(
            projectId,
            projectReference,
            msg.sender,
            block.timestamp
        );
    }

    /// @notice Records that a tender was created for a project.
    /// @param tenderId Off-chain tender identifier.
    /// @param projectId Off-chain project identifier the tender belongs to.
    /// @param tenderReference Human readable tender reference/code.
    function recordTenderCreated(
        uint256 tenderId,
        uint256 projectId,
        string calldata tenderReference
    ) external {
        emit TenderCreated(
            tenderId,
            projectId,
            tenderReference,
            msg.sender,
            block.timestamp
        );
    }

    /// @notice Records that a contractor was assigned to a tender.
    /// @param tenderId Off-chain tender identifier.
    /// @param projectId Off-chain project identifier the tender belongs to.
    /// @param contractorId Off-chain GovChain user id of the assigned contractor.
    function recordTenderAssigned(
        uint256 tenderId,
        uint256 projectId,
        uint256 contractorId
    ) external {
        emit TenderAssigned(
            tenderId,
            projectId,
            contractorId,
            msg.sender,
            block.timestamp
        );
    }

    /// @notice Records that a milestone was created for a project.
    /// @param milestoneId Off-chain milestone identifier.
    /// @param projectId Off-chain project identifier the milestone belongs to.
    /// @param title Short milestone title.
    function recordMilestoneCreated(
        uint256 milestoneId,
        uint256 projectId,
        string calldata title
    ) external {
        emit MilestoneCreated(
            milestoneId,
            projectId,
            title,
            msg.sender,
            block.timestamp
        );
    }

    /// @notice Records that a milestone was submitted for verification.
    /// @param milestoneId Off-chain milestone identifier.
    /// @param projectId Off-chain project identifier the milestone belongs to.
    function recordMilestoneSubmitted(
        uint256 milestoneId,
        uint256 projectId
    ) external {
        emit MilestoneSubmitted(
            milestoneId,
            projectId,
            msg.sender,
            block.timestamp
        );
    }

    /// @notice Records that a submitted milestone was verified.
    /// @param milestoneId Off-chain milestone identifier.
    /// @param projectId Off-chain project identifier the milestone belongs to.
    function recordMilestoneVerified(
        uint256 milestoneId,
        uint256 projectId
    ) external {
        emit MilestoneVerified(
            milestoneId,
            projectId,
            msg.sender,
            block.timestamp
        );
    }

    /// @notice Records that a submitted milestone was rejected.
    /// @param milestoneId Off-chain milestone identifier.
    /// @param projectId Off-chain project identifier the milestone belongs to.
    /// @param reason Short reason for the rejection.
    function recordMilestoneRejected(
        uint256 milestoneId,
        uint256 projectId,
        string calldata reason
    ) external {
        emit MilestoneRejected(
            milestoneId,
            projectId,
            reason,
            msg.sender,
            block.timestamp
        );
    }

    /// @notice Records that a payment for a project was authorized.
    /// @param paymentId Off-chain payment identifier.
    /// @param projectId Off-chain project identifier the payment belongs to.
    /// @param amount Authorized payment amount (as stored off-chain).
    function recordPaymentAuthorized(
        uint256 paymentId,
        uint256 projectId,
        uint256 amount
    ) external {
        emit PaymentAuthorized(
            paymentId,
            projectId,
            amount,
            msg.sender,
            block.timestamp
        );
    }

    /// @notice Records that an authorized payment was released to a recipient.
    /// @dev Audit record only - no funds are transferred by this contract.
    /// @param paymentId Off-chain payment identifier.
    /// @param projectId Off-chain project identifier the payment belongs to.
    /// @param amount Released payment amount (as stored off-chain).
    /// @param recipient Address that received the payment.
    function recordPaymentReleased(
        uint256 paymentId,
        uint256 projectId,
        uint256 amount,
        address recipient
    ) external {
        emit PaymentReleased(
            paymentId,
            projectId,
            amount,
            recipient,
            msg.sender,
            block.timestamp
        );
    }

    /// @notice Returns the name and version of this contract.
    function contractVersion() external pure returns (string memory) {
        return _VERSION;
    }
}
