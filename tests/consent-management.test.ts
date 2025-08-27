// ConsentManagementContract.test.ts
import { describe, expect, it, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface ConsentRecord {
  expiry: number;
  purpose: string;
  status: string;
  createdAt: number;
  lastUpdated: number;
  renewable: boolean;
  delegates: string[];
  notes: string;
}

interface AuditLog {
  action: string;
  actor: string;
  timestamp: number;
  details: string;
}

interface ContractState {
  consents: Map<string, ConsentRecord>; // Key: JSON.stringify({patient, dataType, grantee})
  auditLogs: Map<string, AuditLog>; // Key: JSON.stringify({consentKey, logId})
  logCounters: Map<string, number>; // Key: JSON.stringify(consentKey)
  blockHeight: number;
}

// Mock contract implementation
class ConsentManagementContractMock {
  private state: ContractState = {
    consents: new Map(),
    auditLogs: new Map(),
    logCounters: new Map(),
    blockHeight: 1000, // Starting block height
  };

  private ERR_NOT_OWNER = 100;
  private ERR_INVALID_DATA_TYPE = 101;
  private ERR_INVALID_GRANTEE = 102;
  private ERR_INVALID_DURATION = 103;
  private ERR_CONSENT_EXISTS = 104;
  private ERR_NO_CONSENT = 105;
  private ERR_EXPIRED = 106;
  private ERR_NOT_ACTIVE = 107;
  private ERR_INVALID_PURPOSE = 108;
  private ERR_INVALID_DELEGATE = 109;
  private ERR_NOT_DELEGATED = 110;
  private ERR_INVALID_STATUS = 111;
  private ERR_MAX_DELEGATES_REACHED = 112;
  private ERR_MAX_PURPOSE_LEN = 113;
  private ERR_MAX_NOTES_LEN = 114;
  private MAX_DELEGATES_PER_CONSENT = 5;
  private MAX_PURPOSE_LENGTH = 100;
  private MAX_NOTES_LENGTH = 500;

  // Simulate tx-sender
  private txSender: string = "";

  // Method to set tx-sender for testing
  setTxSender(sender: string) {
    this.txSender = sender;
  }

  // Simulate block-height increase
  incrementBlockHeight(by: number = 1) {
    this.state.blockHeight += by;
  }

  private getConsentKey(patient: string, dataType: string, grantee: string): string {
    return JSON.stringify({ patient, dataType, grantee });
  }

  private getAuditKey(consentKey: string, logId: number): string {
    return JSON.stringify({ consentKey, logId });
  }

  private validateDataType(dataType: string): boolean {
    return dataType.length > 0 && dataType.length <= 50;
  }

  private validatePurpose(purpose: string): boolean {
    return purpose.length > 0 && purpose.length <= this.MAX_PURPOSE_LENGTH;
  }

  private validateNotes(notes: string): boolean {
    return notes.length <= this.MAX_NOTES_LENGTH;
  }

  private validateDuration(duration: number): boolean {
    return duration > 0;
  }

  private isPatientOwner(patient: string): boolean {
    return this.txSender === patient;
  }

  private isDelegate(consentKeyStr: string, caller: string): boolean {
    const consent = this.state.consents.get(consentKeyStr);
    return !!consent && consent.delegates.includes(caller);
  }

  private logAction(consentKeyStr: string, action: string, details: string): ClarityResponse<boolean> {
    const counter = this.state.logCounters.get(consentKeyStr) ?? 0;
    const auditKey = this.getAuditKey(consentKeyStr, counter);
    this.state.auditLogs.set(auditKey, {
      action,
      actor: this.txSender,
      timestamp: this.state.blockHeight,
      details,
    });
    this.state.logCounters.set(consentKeyStr, counter + 1);
    return { ok: true, value: true };
  }

  grantConsent(
    dataType: string,
    grantee: string,
    duration: number,
    purpose: string,
    renewable: boolean,
    notes: string
  ): ClarityResponse<boolean> {
    const patient = this.txSender;
    const consentKeyStr = this.getConsentKey(patient, dataType, grantee);
    if (!this.isPatientOwner(patient)) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (!this.validateDataType(dataType)) {
      return { ok: false, value: this.ERR_INVALID_DATA_TYPE };
    }
    if (grantee === patient) {
      return { ok: false, value: this.ERR_INVALID_GRANTEE };
    }
    if (!this.validateDuration(duration)) {
      return { ok: false, value: this.ERR_INVALID_DURATION };
    }
    if (!this.validatePurpose(purpose)) {
      return { ok: false, value: this.ERR_INVALID_PURPOSE };
    }
    if (!this.validateNotes(notes)) {
      return { ok: false, value: this.ERR_MAX_NOTES_LEN };
    }
    if (this.state.consents.has(consentKeyStr)) {
      return { ok: false, value: this.ERR_CONSENT_EXISTS };
    }
    const expiry = this.state.blockHeight + duration;
    this.state.consents.set(consentKeyStr, {
      expiry,
      purpose,
      status: "active",
      createdAt: this.state.blockHeight,
      lastUpdated: this.state.blockHeight,
      renewable,
      delegates: [],
      notes,
    });
    this.logAction(consentKeyStr, "granted", `Granted for duration ${duration}`);
    return { ok: true, value: true };
  }

  revokeConsent(dataType: string, grantee: string): ClarityResponse<boolean> {
    const patient = this.txSender;
    const consentKeyStr = this.getConsentKey(patient, dataType, grantee);
    const consent = this.state.consents.get(consentKeyStr);
    if (!consent) {
      return { ok: false, value: this.ERR_NO_CONSENT };
    }
    if (!this.isPatientOwner(patient) && !this.isDelegate(consentKeyStr, this.txSender)) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (consent.status !== "active") {
      return { ok: false, value: this.ERR_NOT_ACTIVE };
    }
    this.state.consents.set(consentKeyStr, {
      ...consent,
      status: "revoked",
      lastUpdated: this.state.blockHeight,
    });
    this.logAction(consentKeyStr, "revoked", "Consent revoked by owner or delegate");
    return { ok: true, value: true };
  }

  renewConsent(dataType: string, grantee: string, newDuration: number): ClarityResponse<boolean> {
    const patient = this.txSender;
    const consentKeyStr = this.getConsentKey(patient, dataType, grantee);
    const consent = this.state.consents.get(consentKeyStr);
    if (!consent) {
      return { ok: false, value: this.ERR_NO_CONSENT };
    }
    if (!this.isPatientOwner(patient) && !this.isDelegate(consentKeyStr, this.txSender)) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (!consent.renewable) {
      return { ok: false, value: this.ERR_INVALID_STATUS };
    }
    if (consent.status !== "active" && consent.status !== "expired") {
      return { ok: false, value: this.ERR_NOT_ACTIVE };
    }
    if (!this.validateDuration(newDuration)) {
      return { ok: false, value: this.ERR_INVALID_DURATION };
    }
    const newExpiry = this.state.blockHeight + newDuration;
    this.state.consents.set(consentKeyStr, {
      ...consent,
      expiry: newExpiry,
      status: "renewed",
      lastUpdated: this.state.blockHeight,
    });
    this.logAction(consentKeyStr, "renewed", `Renewed for ${newDuration}`);
    return { ok: true, value: true };
  }

  addDelegate(dataType: string, grantee: string, delegate: string): ClarityResponse<boolean> {
    const patient = this.txSender;
    const consentKeyStr = this.getConsentKey(patient, dataType, grantee);
    const consent = this.state.consents.get(consentKeyStr);
    if (!consent) {
      return { ok: false, value: this.ERR_NO_CONSENT };
    }
    if (!this.isPatientOwner(patient)) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (consent.status !== "active") {
      return { ok: false, value: this.ERR_NOT_ACTIVE };
    }
    if (delegate === patient) {
      return { ok: false, value: this.ERR_INVALID_DELEGATE };
    }
    if (consent.delegates.includes(delegate)) {
      return { ok: false, value: this.ERR_CONSENT_EXISTS };
    }
    if (consent.delegates.length >= this.MAX_DELEGATES_PER_CONSENT) {
      return { ok: false, value: this.ERR_MAX_DELEGATES_REACHED };
    }
    const newDelegates = [...consent.delegates, delegate];
    this.state.consents.set(consentKeyStr, {
      ...consent,
      delegates: newDelegates,
    });
    this.logAction(consentKeyStr, "delegate-added", `Added delegate: ${delegate}`);
    return { ok: true, value: true };
  }

  removeDelegate(dataType: string, grantee: string, delegate: string): ClarityResponse<boolean> {
    const patient = this.txSender;
    const consentKeyStr = this.getConsentKey(patient, dataType, grantee);
    const consent = this.state.consents.get(consentKeyStr);
    if (!consent) {
      return { ok: false, value: this.ERR_NO_CONSENT };
    }
    if (!this.isPatientOwner(patient)) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (consent.status !== "active") {
      return { ok: false, value: this.ERR_NOT_ACTIVE };
    }
    const newDelegates = consent.delegates.filter((d) => d !== delegate);
    this.state.consents.set(consentKeyStr, {
      ...consent,
      delegates: newDelegates,
    });
    this.logAction(consentKeyStr, "delegate-removed", `Removed delegate: ${delegate}`);
    return { ok: true, value: true };
  }

  updateNotes(dataType: string, grantee: string, newNotes: string): ClarityResponse<boolean> {
    const patient = this.txSender;
    const consentKeyStr = this.getConsentKey(patient, dataType, grantee);
    const consent = this.state.consents.get(consentKeyStr);
    if (!consent) {
      return { ok: false, value: this.ERR_NO_CONSENT };
    }
    if (!this.isPatientOwner(patient) && !this.isDelegate(consentKeyStr, this.txSender)) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (consent.status !== "active") {
      return { ok: false, value: this.ERR_NOT_ACTIVE };
    }
    if (!this.validateNotes(newNotes)) {
      return { ok: false, value: this.ERR_MAX_NOTES_LEN };
    }
    this.state.consents.set(consentKeyStr, {
      ...consent,
      notes: newNotes,
      lastUpdated: this.state.blockHeight,
    });
    this.logAction(consentKeyStr, "notes-updated", "Updated consent notes");
    return { ok: true, value: true };
  }

  checkConsent(patient: string, dataType: string, grantee: string): ClarityResponse<boolean> {
    const consentKeyStr = this.getConsentKey(patient, dataType, grantee);
    const consent = this.state.consents.get(consentKeyStr);
    if (!consent) {
      return { ok: false, value: this.ERR_NO_CONSENT };
    }
    if (consent.status !== "active") {
      return { ok: false, value: this.ERR_NOT_ACTIVE };
    }
    if (consent.expiry <= this.state.blockHeight) {
      return { ok: false, value: this.ERR_EXPIRED };
    }
    return { ok: true, value: true };
  }

  getConsentDetails(patient: string, dataType: string, grantee: string): ClarityResponse<ConsentRecord | null> {
    const consentKeyStr = this.getConsentKey(patient, dataType, grantee);
    return { ok: true, value: this.state.consents.get(consentKeyStr) ?? null };
  }

  getAuditLog(patient: string, dataType: string, grantee: string, logId: number): ClarityResponse<AuditLog | null> {
    const consentKeyStr = this.getConsentKey(patient, dataType, grantee);
    const auditKey = this.getAuditKey(consentKeyStr, logId);
    return { ok: true, value: this.state.auditLogs.get(auditKey) ?? null };
  }

  getLogCount(patient: string, dataType: string, grantee: string): ClarityResponse<number> {
    const consentKeyStr = this.getConsentKey(patient, dataType, grantee);
    return { ok: true, value: this.state.logCounters.get(consentKeyStr) ?? 0 };
  }

  logAccessAttempt(
    patient: string,
    dataType: string,
    grantee: string,
    success: boolean,
    details: string
  ): ClarityResponse<boolean> {
    const consentKeyStr = this.getConsentKey(patient, dataType, grantee);
    if (!this.state.consents.has(consentKeyStr)) {
      return { ok: false, value: this.ERR_NO_CONSENT };
    }
    this.logAction(consentKeyStr, success ? "access-granted" : "access-denied", details);
    return { ok: true, value: true };
  }
}

// Test setup
const accounts = {
  patient: "patient_wallet",
  grantee: "provider_wallet",
  delegate: "delegate_wallet",
  unauthorized: "unauthorized_wallet",
};

describe("ConsentManagementContract", () => {
  let contract: ConsentManagementContractMock;

  beforeEach(() => {
    contract = new ConsentManagementContractMock();
  });

  it("should allow patient to grant consent", () => {
    contract.setTxSender(accounts.patient);
    const result = contract.grantConsent(
      "lab-results",
      accounts.grantee,
      100,
      "Medical treatment",
      true,
      "Initial consent"
    );
    expect(result).toEqual({ ok: true, value: true });

    const details = contract.getConsentDetails(accounts.patient, "lab-results", accounts.grantee);
    expect(details.ok).toBe(true);
    expect(details.value).toEqual(
      expect.objectContaining({
        expiry: 1100,
        purpose: "Medical treatment",
        status: "active",
        renewable: true,
        notes: "Initial consent",
        delegates: [],
      })
    );

    const logCount = contract.getLogCount(accounts.patient, "lab-results", accounts.grantee);
    expect(logCount).toEqual({ ok: true, value: 1 });

    const log = contract.getAuditLog(accounts.patient, "lab-results", accounts.grantee, 0);
    expect(log).toEqual({
      ok: true,
      value: expect.objectContaining({
        action: "granted",
        actor: accounts.patient,
      }),
    });
  });


  it("should allow patient or delegate to revoke consent", () => {
    contract.setTxSender(accounts.patient);
    contract.grantConsent("lab-results", accounts.grantee, 100, "Treatment", true, "");

    const revokeResult = contract.revokeConsent("lab-results", accounts.grantee);
    expect(revokeResult).toEqual({ ok: true, value: true });

    const details = contract.getConsentDetails(accounts.patient, "lab-results", accounts.grantee);
    expect(details.value?.status).toBe("revoked");
  });

  it("should allow renewal if renewable", () => {
    contract.setTxSender(accounts.patient);
    contract.grantConsent("lab-results", accounts.grantee, 100, "Treatment", true, "");

    const renewResult = contract.renewConsent("lab-results", accounts.grantee, 200);
    expect(renewResult).toEqual({ ok: true, value: true });

    const details = contract.getConsentDetails(accounts.patient, "lab-results", accounts.grantee);
    expect(details.value?.expiry).toBe(1200);
    expect(details.value?.status).toBe("renewed");
  });

  it("should prevent renewal if not renewable", () => {
    contract.setTxSender(accounts.patient);
    contract.grantConsent("lab-results", accounts.grantee, 100, "Treatment", false, "");

    const renewResult = contract.renewConsent("lab-results", accounts.grantee, 200);
    expect(renewResult).toEqual({ ok: false, value: 111 });
  });

  it("should handle expiration in check-consent", () => {
    contract.setTxSender(accounts.patient);
    contract.grantConsent("lab-results", accounts.grantee, 100, "Treatment", true, "");

    contract.incrementBlockHeight(101);
    const checkResult = contract.checkConsent(accounts.patient, "lab-results", accounts.grantee);
    expect(checkResult).toEqual({ ok: false, value: 106 });
  });

  it("should add and remove delegates", () => {
    contract.setTxSender(accounts.patient);
    contract.grantConsent("lab-results", accounts.grantee, 100, "Treatment", true, "");

    const addResult = contract.addDelegate("lab-results", accounts.grantee, accounts.delegate);
    expect(addResult).toEqual({ ok: true, value: true });

    let details = contract.getConsentDetails(accounts.patient, "lab-results", accounts.grantee);
    expect(details.value?.delegates).toContain(accounts.delegate);

    const removeResult = contract.removeDelegate("lab-results", accounts.grantee, accounts.delegate);
    expect(removeResult).toEqual({ ok: true, value: true });

    details = contract.getConsentDetails(accounts.patient, "lab-results", accounts.grantee);
    expect(details.value?.delegates).not.toContain(accounts.delegate);
  });

  it("should log access attempts", () => {
    contract.setTxSender(accounts.patient);
    contract.grantConsent("lab-results", accounts.grantee, 100, "Treatment", true, "");

    const logResult = contract.logAccessAttempt(
      accounts.patient,
      "lab-results",
      accounts.grantee,
      true,
      "Access for treatment"
    );
    expect(logResult).toEqual({ ok: true, value: true });

    const log = contract.getAuditLog(accounts.patient, "lab-results", accounts.grantee, 1);
    expect(log).toEqual({
      ok: true,
      value: expect.objectContaining({
        action: "access-granted",
        details: "Access for treatment",
      }),
    });
  });

  it("should enforce max delegates", () => {
    contract.setTxSender(accounts.patient);
    contract.grantConsent("lab-results", accounts.grantee, 100, "Treatment", true, "");

    for (let i = 1; i <= 5; i++) {
      contract.addDelegate("lab-results", accounts.grantee, `delegate_${i}`);
    }

    const addExtra = contract.addDelegate("lab-results", accounts.grantee, "extra_delegate");
    expect(addExtra).toEqual({ ok: false, value: 112 });
  });

  it("should validate input lengths", () => {
    contract.setTxSender(accounts.patient);
    const longPurpose = "a".repeat(101);
    const result = contract.grantConsent(
      "lab-results",
      accounts.grantee,
      100,
      longPurpose,
      true,
      ""
    );
    expect(result).toEqual({ ok: false, value: 108 });

    const longNotes = "a".repeat(501);
    const resultNotes = contract.grantConsent(
      "lab-results",
      accounts.grantee,
      100,
      "Treatment",
      true,
      longNotes
    );
    expect(resultNotes).toEqual({ ok: false, value: 114 });
  });
});