;; ConsentManagementContract.clar
;; Sophisticated Consent Management for Decentralized Healthcare
;; This contract handles granular patient consent for medical data sharing.
;; Features include: time-bound consents, data category specifics, consent delegation,
;; renewal options, status tracking, event emissions, and audit logging.
;; Ensures compliance with privacy regulations through immutable records.

;; Constants
(define-constant ERR-NOT-OWNER u100) ;; Caller is not the patient/owner
(define-constant ERR-INVALID-DATA-TYPE u101) ;; Invalid data type specified
(define-constant ERR-INVALID-GRANTEE u102) ;; Invalid grantee principal
(define-constant ERR-INVALID-DURATION u103) ;; Duration must be positive
(define-constant ERR-CONSENT-EXISTS u104) ;; Consent already exists
(define-constant ERR-NO-CONSENT u105) ;; No such consent found
(define-constant ERR-EXPIRED u106) ;; Consent has expired
(define-constant ERR-NOT-ACTIVE u107) ;; Consent is not active
(define-constant ERR-INVALID-PURPOSE u108) ;; Invalid purpose string
(define-constant ERR-INVALID-DELEGATE u109) ;; Invalid delegate principal
(define-constant ERR-NOT-DELEGATED u110) ;; Caller not delegated
(define-constant ERR-INVALID-STATUS u111) ;; Invalid status transition
(define-constant ERR-MAX-DELEGATES-REACHED u112) ;; Too many delegates
(define-constant ERR-MAX-PURPOSE-LEN u113) ;; Purpose too long
(define-constant ERR-MAX-NOTES-LEN u114) ;; Notes too long
(define-constant MAX-DELEGATES-PER-CONSENT u5) ;; Limit delegates per consent
(define-constant MAX-PURPOSE-LENGTH u100) ;; Max chars for purpose
(define-constant MAX-NOTES-LENGTH u500) ;; Max chars for notes

;; Data Types
(define-trait provider-trait
  (
    (verify-provider (principal) (response bool uint))
  )
)

;; Data Maps
;; Main consent map: Keyed by patient, data-type, grantee
(define-map consents
  { patient: principal, data-type: (string-ascii 50), grantee: principal }
  {
    expiry: uint, ;; Block height when expires
    purpose: (string-utf8 100), ;; Purpose of sharing
    status: (string-ascii 20), ;; "active", "revoked", "expired", "renewed"
    created-at: uint,
    last-updated: uint,
    renewable: bool, ;; Can be renewed
    delegates: (list 5 principal), ;; Delegated principals who can manage
    notes: (string-utf8 500) ;; Additional notes
  }
)

;; Audit log map: Sequential logs per consent
(define-map audit-logs
  { consent-key: { patient: principal, data-type: (string-ascii 50), grantee: principal }, log-id: uint }
  {
    action: (string-ascii 50), ;; "granted", "revoked", "renewed", "accessed", etc.
    actor: principal,
    timestamp: uint,
    details: (string-utf8 200)
  }
)

;; Log counter per consent
(define-map log-counters
  { patient: principal, data-type: (string-ascii 50), grantee: principal }
  uint
)

;; Private Functions
(define-private (is-patient-owner (patient principal))
  (is-eq tx-sender patient)
)

(define-private (is-delegate (consent-key { patient: principal, data-type: (string-ascii 50), grantee: principal }) (caller principal))
  (let ((consent (unwrap! (map-get? consents consent-key) false)))
    (is-some (index-of? (get delegates consent) caller))
  )
)

(define-private (log-action (consent-key { patient: principal, data-type: (string-ascii 50), grantee: principal })
                            (action (string-ascii 50))
                            (details (string-utf8 200)))
  (let ((counter (default-to u0 (map-get? log-counters consent-key))))
    (map-set audit-logs { consent-key: consent-key, log-id: counter }
      {
        action: action,
        actor: tx-sender,
        timestamp: block-height,
        details: details
      }
    )
    (map-set log-counters consent-key (+ counter u1))
    (ok true)
  )
)

(define-private (validate-data-type (data-type (string-ascii 50)))
  (and (> (len data-type) u0) (<= (len data-type) u50))
)

(define-private (validate-purpose (purpose (string-utf8 100)))
  (and (<= (len purpose) MAX-PURPOSE-LENGTH) (> (len purpose) u0))
)

(define-private (validate-notes (notes (string-utf8 500)))
  (<= (len notes) MAX-NOTES-LENGTH)
)

(define-private (validate-duration (duration uint))
  (> duration u0)
)

(define-private (check-expiry (expiry uint))
  (> expiry block-height)
)

;; Public Functions
(define-public (grant-consent
  (data-type (string-ascii 50))
  (grantee principal)
  (duration uint)
  (purpose (string-utf8 100))
  (renewable bool)
  (notes (string-utf8 500)))
  (let ((patient tx-sender)
        (consent-key { patient: patient, data-type: data-type, grantee: grantee })
        (expiry (+ block-height duration)))
    (asserts! (is-patient-owner patient) (err ERR-NOT-OWNER))
    (asserts! (validate-data-type data-type) (err ERR-INVALID-DATA-TYPE))
    (asserts! (not (is-eq grantee patient)) (err ERR-INVALID-GRANTEE)) ;; Can't grant to self
    (asserts! (validate-duration duration) (err ERR-INVALID-DURATION))
    (asserts! (validate-purpose purpose) (err ERR-INVALID-PURPOSE))
    (asserts! (validate-notes notes) (err ERR-MAX-NOTES-LEN))
    (asserts! (is-none (map-get? consents consent-key)) (err ERR-CONSENT-EXISTS))
    (map-set consents consent-key
      {
        expiry: expiry,
        purpose: purpose,
        status: "active",
        created-at: block-height,
        last-updated: block-height,
        renewable: renewable,
        delegates: (list ),
        notes: notes
      }
    )
    (try! (log-action consent-key "granted" (concat "Granted for duration " (int-to-utf8 (to-int duration)))))
    (print { event: "consent-granted", key: consent-key, expiry: expiry })
    (ok true)
  )
)

(define-public (revoke-consent
  (data-type (string-ascii 50))
  (grantee principal))
  (let ((patient tx-sender)
        (consent-key { patient: patient, data-type: data-type, grantee: grantee })
        (consent (unwrap! (map-get? consents consent-key) (err ERR-NO-CONSENT))))
    (asserts! (or (is-patient-owner patient) (is-delegate consent-key tx-sender)) (err ERR-NOT-OWNER))
    (asserts! (is-eq (get status consent) "active") (err ERR-NOT-ACTIVE))
    (map-set consents consent-key
      (merge consent { status: "revoked", last-updated: block-height })
    )
    (try! (log-action consent-key "revoked" "Consent revoked by owner or delegate"))
    (print { event: "consent-revoked", key: consent-key })
    (ok true)
  )
)

(define-public (renew-consent
  (data-type (string-ascii 50))
  (grantee principal)
  (new-duration uint))
  (let ((patient tx-sender)
        (consent-key { patient: patient, data-type: data-type, grantee: grantee })
        (consent (unwrap! (map-get? consents consent-key) (err ERR-NO-CONSENT))))
    (asserts! (or (is-patient-owner patient) (is-delegate consent-key tx-sender)) (err ERR-NOT-OWNER))
    (asserts! (get renewable consent) (err ERR-INVALID-STATUS))
    (asserts! (or (is-eq (get status consent) "active") (is-eq (get status consent) "expired")) (err ERR-NOT-ACTIVE))
    (asserts! (validate-duration new-duration) (err ERR-INVALID-DURATION))
    (let ((new-expiry (+ block-height new-duration)))
      (map-set consents consent-key
        (merge consent { expiry: new-expiry, status: "renewed", last-updated: block-height })
      )
      (try! (log-action consent-key "renewed" (concat "Renewed for " (int-to-utf8 (to-int new-duration)))))
      (print { event: "consent-renewed", key: consent-key, new-expiry: new-expiry })
      (ok true)
    )
  )
)

(define-public (add-delegate
  (data-type (string-ascii 50))
  (grantee principal)
  (delegate principal))
  (let ((patient tx-sender)
        (consent-key { patient: patient, data-type: data-type, grantee: grantee })
        (consent (unwrap! (map-get? consents consent-key) (err ERR-NO-CONSENT))))
    (asserts! (is-patient-owner patient) (err ERR-NOT-OWNER))
    (asserts! (is-eq (get status consent) "active") (err ERR-NOT-ACTIVE))
    (asserts! (not (is-eq delegate patient)) (err ERR-INVALID-DELEGATE))
    (asserts! (not (is-some (index-of? (get delegates consent) delegate))) (err ERR-CONSENT-EXISTS))
    (asserts! (< (len (get delegates consent)) MAX-DELEGATES-PER-CONSENT) (err ERR-MAX-DELEGATES-REACHED))
    (map-set consents consent-key
      (merge consent { delegates: (unwrap-panic (as-max-len? (append (get delegates consent) delegate) u5)) })
    )
    (try! (log-action consent-key "delegate-added" (concat "Added delegate: " (principal-to-string delegate))))
    (print { event: "delegate-added", key: consent-key, delegate: delegate })
    (ok true)
  )
)

(define-public (remove-delegate
  (data-type (string-ascii 50))
  (grantee principal)
  (delegate principal))
  (let ((patient tx-sender)
        (consent-key { patient: patient, data-type: data-type, grantee: grantee })
        (consent (unwrap! (map-get? consents consent-key) (err ERR-NO-CONSENT))))
    (asserts! (is-patient-owner patient) (err ERR-NOT-OWNER))
    (asserts! (is-eq (get status consent) "active") (err ERR-NOT-ACTIVE))
    (let ((delegates (get delegates consent))
          (new-delegates (filter (lambda (d) (not (is-eq d delegate))) delegates)))
      (map-set consents consent-key
        (merge consent { delegates: new-delegates })
      )
      (try! (log-action consent-key "delegate-removed" (concat "Removed delegate: " (principal-to-string delegate))))
      (print { event: "delegate-removed", key: consent-key, delegate: delegate })
      (ok true)
    )
  )
)

(define-public (update-notes
  (data-type (string-ascii 50))
  (grantee principal)
  (new-notes (string-utf8 500)))
  (let ((patient tx-sender)
        (consent-key { patient: patient, data-type: data-type, grantee: grantee })
        (consent (unwrap! (map-get? consents consent-key) (err ERR-NO-CONSENT))))
    (asserts! (or (is-patient-owner patient) (is-delegate consent-key tx-sender)) (err ERR-NOT-OWNER))
    (asserts! (is-eq (get status consent) "active") (err ERR-NOT-ACTIVE))
    (asserts! (validate-notes new-notes) (err ERR-MAX-NOTES-LEN))
    (map-set consents consent-key
      (merge consent { notes: new-notes, last-updated: block-height })
    )
    (try! (log-action consent-key "notes-updated" "Updated consent notes"))
    (print { event: "notes-updated", key: consent-key })
    (ok true)
  )
)

;; Read-Only Functions
(define-read-only (check-consent
  (patient principal)
  (data-type (string-ascii 50))
  (grantee principal))
  (let ((consent-key { patient: patient, data-type: data-type, grantee: grantee })
        (consent (map-get? consents consent-key)))
    (match consent
      some-consent
        (if (and (is-eq (get status some-consent) "active")
                 (check-expiry (get expiry some-consent)))
          (begin
            (ok true)
          )
          (if (is-eq (get status some-consent) "expired")
            (err ERR-EXPIRED)
            (err ERR-NOT-ACTIVE)
          )
        )
      (err ERR-NO-CONSENT)
    )
  )
)

(define-read-only (get-consent-details
  (patient principal)
  (data-type (string-ascii 50))
  (grantee principal))
  (map-get? consents { patient: patient, data-type: data-type, grantee: grantee })
)

(define-read-only (get-audit-log
  (patient principal)
  (data-type (string-ascii 50))
  (grantee principal)
  (log-id uint))
  (map-get? audit-logs { consent-key: { patient: patient, data-type: data-type, grantee: grantee }, log-id: log-id })
)

(define-read-only (get-log-count
  (patient principal)
  (data-type (string-ascii 50))
  (grantee principal))
  (default-to u0 (map-get? log-counters { patient: patient, data-type: data-type, grantee: grantee }))
)

;; Utility to log access attempts (called from AccessControlContract)
(define-public (log-access-attempt
  (patient principal)
  (data-type (string-ascii 50))
  (grantee principal)
  (success bool)
  (details (string-utf8 200)))
  (let ((consent-key { patient: patient, data-type: data-type, grantee: grantee }))
    (asserts! (is-some (map-get? consents consent-key)) (err ERR-NO-CONSENT))
    (try! (log-action consent-key (if success "access-granted" "access-denied") details))
    (ok true)
  )
)