#![cfg(test)]

use crate::payments::{
    EscrowAccount, FeeStructure, Payment, PaymentError, PaymentStatus, ReleaseConditions,
    TransactionMetadata,
};

use soroban_sdk::{testutils::Address as _, vec, Address, Env, Symbol};
// ======================================================
// Payment Validation Tests
// ======================================================

#[test]
fn payment_validates_successfully() {
    let env = Env::default();
    let payer = Address::generate(&env);
    let payee = Address::generate(&env);
    let asset = Address::generate(&env);

    let payment = Payment {
        id: 1,
        request_id: 10,
        payer,
        payee,
        amount: 1_000,
        asset,
        status: PaymentStatus::Pending,
        escrow_released_at: None,
    };

    assert!(payment.validate().is_ok());
}

#[test]
fn payment_fails_with_zero_amount() {
    let env = Env::default();

    let payment = Payment {
        id: 1,
        request_id: 10,
        payer: Address::generate(&env),
        payee: Address::generate(&env),
        amount: 0,
        asset: Address::generate(&env),
        status: PaymentStatus::Pending,
        escrow_released_at: None,
    };

    assert_eq!(payment.validate(), Err(PaymentError::InvalidAmount));
}

#[test]
fn payment_fails_when_payer_equals_payee() {
    let env = Env::default();
    let addr = Address::generate(&env);

    let payment = Payment {
        id: 1,
        request_id: 10,
        payer: addr.clone(),
        payee: addr.clone(),
        amount: 1_000,
        asset: Address::generate(&env),
        status: PaymentStatus::Pending,
        escrow_released_at: None,
    };

    assert_eq!(payment.validate(), Err(PaymentError::SamePayerPayee));
}

#[test]
fn payment_fails_when_asset_equals_payer() {
    let env = Env::default();
    let payer = Address::generate(&env);

    let payment = Payment {
        id: 1,
        request_id: 10,
        payer: payer.clone(),
        payee: Address::generate(&env),
        amount: 1_000,
        asset: payer,
        status: PaymentStatus::Pending,
        escrow_released_at: None,
    };

    assert_eq!(payment.validate(), Err(PaymentError::InvalidAsset));
}

#[test]
fn payment_fails_when_asset_equals_payee() {
    let env = Env::default();
    let payee = Address::generate(&env);

    let payment = Payment {
        id: 1,
        request_id: 10,
        payer: Address::generate(&env),
        payee: payee.clone(),
        amount: 1_000,
        asset: payee,
        status: PaymentStatus::Pending,
        escrow_released_at: None,
    };

    assert_eq!(payment.validate(), Err(PaymentError::InvalidAsset));
}

// ======================================================
// Payment Status Transition Tests
// ======================================================

#[test]
fn payment_state_machine_is_correct() {
    let env = Env::default();

    let payment = Payment {
        id: 1,
        request_id: 10,
        payer: Address::generate(&env),
        payee: Address::generate(&env),
        amount: 1_000,
        asset: Address::generate(&env),
        status: PaymentStatus::Pending,
        escrow_released_at: None,
    };

    assert!(payment.can_transition_to(PaymentStatus::Cancelled));
    assert!(payment.can_transition_to(PaymentStatus::Escrowed));
    assert!(!payment.can_transition_to(PaymentStatus::Completed));

    // From Escrowed
    let escrowed_payment = Payment {
        status: PaymentStatus::Escrowed,
        ..payment.clone()
    };
    assert!(escrowed_payment.can_transition_to(PaymentStatus::Disputed));
    assert!(escrowed_payment.can_transition_to(PaymentStatus::Completed));
    assert!(escrowed_payment.can_transition_to(PaymentStatus::Refunded));

    // From Disputed
    let disputed_payment = Payment {
        status: PaymentStatus::Disputed,
        ..payment.clone()
    };
    assert!(disputed_payment.can_transition_to(PaymentStatus::Resolved));
    assert!(!disputed_payment.can_transition_to(PaymentStatus::Completed));

    // From Resolved
    let resolved_payment = Payment {
        status: PaymentStatus::Resolved,
        ..payment.clone()
    };
    assert!(resolved_payment.can_transition_to(PaymentStatus::Completed));
    assert!(resolved_payment.can_transition_to(PaymentStatus::Refunded));
}

#[test]
fn dispute_structure_is_valid() {
    let env = Env::default();
    let raiser = Address::generate(&env);
    use crate::payments::{Dispute, DisputeStatus};

    let dispute = Dispute {
        id: 1,
        payment_id: 10,
        raised_by: raiser,
        status: DisputeStatus::Open,
        reason: Symbol::new(&env, "delayed"),
        evidence_hash: Symbol::new(&env, "hash123"),
        raised_at: 1000,
        resolved_at: None,
    };

    assert_eq!(dispute.status, DisputeStatus::Open);
}

#[test]
fn terminal_states_are_enforced() {
    let env = Env::default();

    for status in [
        PaymentStatus::Completed,
        PaymentStatus::Refunded,
        PaymentStatus::Cancelled,
    ] {
        let payment = Payment {
            id: 1,
            request_id: 10,
            payer: Address::generate(&env),
            payee: Address::generate(&env),
            amount: 1_000,
            asset: Address::generate(&env),
            status,
            escrow_released_at: None,
        };

        assert!(payment.is_terminal());
        assert!(!payment.can_transition_to(PaymentStatus::Pending));
    }
}

// ======================================================
// EscrowAccount Tests
// ======================================================

#[test]
fn escrow_validates_and_releases_correctly() {
    let env = Env::default();
    let approver = Address::generate(&env);

    let escrow = EscrowAccount {
        payment_id: 1,
        locked_amount: 1_000,
        release_conditions: ReleaseConditions {
            medical_records_verified: true,
            min_timestamp: 100,
            authorized_approver: Some(approver.clone()),
        },
    };

    assert!(escrow.validate().is_ok());
    assert!(escrow.can_release(200, Some(&approver)));
}

#[test]
fn escrow_fails_release_without_conditions() {
    let escrow = EscrowAccount {
        payment_id: 1,
        locked_amount: 1_000,
        release_conditions: ReleaseConditions {
            medical_records_verified: false,
            min_timestamp: 100,
            authorized_approver: None,
        },
    };

    assert!(!escrow.can_release(200, None));
}

// ======================================================
// FeeStructure Tests
// ======================================================

#[test]
fn fee_calculation_is_correct() {
    let fees = FeeStructure {
        service_fee: 10,
        network_fee: 5,
        performance_bonus: 5,
    };

    assert_eq!(fees.total(), 20);
    assert_eq!(fees.calculate_net_amount(1_000).unwrap(), 980);
}

#[test]
fn fees_cannot_exceed_payment_amount() {
    let fees = FeeStructure {
        service_fee: 600,
        network_fee: 300,
        performance_bonus: 200,
    };

    assert_eq!(
        fees.calculate_net_amount(1_000),
        Err(PaymentError::FeesExceedAmount)
    );
}

// ======================================================
// Transaction Metadata Tests
// ======================================================
#[test]
fn transaction_metadata_is_valid() {
    let env = Env::default();

    let metadata = TransactionMetadata {
        description: Symbol::new(&env, "medical_payment"),
        tags: vec![&env, Symbol::new(&env, "health")],
        reference_url: Symbol::new(&env, "ref_001"),
    };

    assert_eq!(metadata.tags.len(), 1);
}
