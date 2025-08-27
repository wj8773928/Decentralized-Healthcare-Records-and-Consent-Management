# 🩺 Decentralized Healthcare Records and Consent Management

Welcome to a groundbreaking decentralized application that revolutionizes healthcare data management! This Web3 project empowers patients to control their medical records, manage consent for data sharing, and ensure secure, transparent access for healthcare providers, researchers, and insurers. Built on the Stacks blockchain using Clarity smart contracts, it addresses real-world problems like fragmented medical records, lack of patient agency, data breaches, and inefficient consent processes, all while ensuring compliance with regulations like HIPAA and GDPR.

## ✨ Features

🔒 **Patient-Controlled Records**: Patients own and manage their encrypted medical data on the blockchain.
✅ **Granular Consent Management**: Grant or revoke access to specific data (e.g., lab results, prescriptions) for specific entities.
🌍 **Interoperable Access**: Healthcare providers access unified patient records across institutions securely.
🔍 **Audit Trail**: Immutable logs of all data access and consent changes for transparency and compliance.
🧬 **Research Data Sharing**: Patients can opt-in to share anonymized data with researchers, earning tokens.
🚨 **Emergency Access**: Predefined rules for emergency data access (e.g., ER doctors) with patient consent.
💸 **Incentive Tokens**: Reward patients for sharing data and providers for maintaining accurate records.
📱 **User-Friendly dApp**: Patients and providers interact via a secure mobile/web interface.

## 🛠 How It Works

This project leverages 9 Clarity smart contracts to create a secure, modular, and scalable healthcare ecosystem. Each contract handles a specific function, ensuring privacy, interoperability, and auditability.

## 🛠 Smart Contracts

1. **PatientRegistryContract.clar**
   - Registers patients with a unique ID and public key.
   - Stores basic profile data (encrypted) and emergency contact info.
   - Functions: `register-patient`, `update-profile`, `get-patient-info`.

2. **ProviderRegistryContract.clar**
   - Authenticates healthcare providers, clinics, and insurers with verified roles.
   - Manages provider permissions and public keys.
   - Functions: `register-provider`, `verify-provider`, `revoke-provider`.

3. **RecordStorageContract.clar**
   - Stores encrypted medical records (e.g., diagnoses, prescriptions) linked to patient IDs.
   - Uses patient-controlled encryption keys for data security.
   - Functions: `store-record`, `update-record`, `delete-record`.

4. **ConsentManagementContract.clar**
   - Manages patient consent for data sharing with specific entities (e.g., doctor, researcher).
   - Supports granular consent (e.g., share only lab results for 30 days).
   - Functions: `grant-consent`, `revoke-consent`, `check-consent`.

5. **AccessControlContract.clar**
   - Enforces access rules based on consent and provider roles.
   - Handles emergency access with predefined patient rules.
   - Functions: `request-access`, `grant-emergency-access`, `log-access`.

6. **AuditTrailContract.clar**
   - Logs all data access, consent changes, and record updates immutably.
   - Enables compliance checks for regulators.
   - Functions: `log-action`, `query-audit-trail`.

7. **ResearchDataContract.clar**
   - Allows patients to share anonymized data with researchers under strict consent.
   - Manages data queries and ensures no re-identification.
   - Functions: `opt-in-research`, `query-anonymized-data`.

8. **TokenIncentiveContract.clar**
   - Issues utility tokens to patients for sharing data and providers for accurate record-keeping.
   - Manages token distribution and balance checks.
   - Functions: `issue-tokens`, `transfer-tokens`, `check-balance`.

9. **QueryInterfaceContract.clar**
   - Provides a unified interface for patients and providers to query records, consent status, and audit logs.
   - Ensures only authorized queries are processed.
   - Functions: `query-records`, `query-consent`, `query-audit`.

## 🧑‍⚕️ For Patients

- Register via PatientRegistryContract to create a secure profile.
- Upload encrypted medical records using RecordStorageContract.
- Use ConsentManagementContract to grant/revoke access (e.g., share X-rays with a specialist for 1 month).
- Opt-in to share anonymized data for research via ResearchDataContract and earn tokens.
- Access your records and audit logs anytime via the dApp using QueryInterfaceContract.

## 🩺 For Providers

- Register via ProviderRegistryContract to gain verified access.
- Request patient data using AccessControlContract, respecting consent rules.
- Add/update records in RecordStorageContract (e.g., new diagnosis or prescription).
- Earn tokens for timely, accurate record updates via TokenIncentiveContract.
- Query patient history securely via QueryInterfaceContract.

## 🔬 For Researchers

- Query anonymized datasets via ResearchDataContract with patient consent.
- Use QueryInterfaceContract to access aggregated, de-identified data for studies.

## 🚑 For Emergency Use

- AccessControlContract allows ER staff to access critical data (e.g., allergies, blood type) if pre-approved by the patient.
- All access is logged in AuditTrailContract for transparency.

## 🛡️ Security and Compliance

- **Encryption**: Patient data is encrypted with patient-controlled keys.
- **Immutability**: Stacks blockchain ensures tamper-proof records and logs.
- **Compliance**: AuditTrailContract supports HIPAA/GDPR audits.
- **Decentralization**: No single point of failure; patients own their data.

## 🚀 Why This Is Better

Unlike the food supply chain tracker, this project:
- Addresses a universal problem: fragmented healthcare systems and lack of patient control.
- Impacts billions of lives by improving care coordination and trust.
- Offers granular consent, balancing privacy with accessibility.
- Enables research while protecting identity, advancing medical innovation.
- Integrates emergency access, solving real-time critical needs.
- Scales globally with regulatory compliance, making it versatile for diverse healthcare systems.

Deploy on Stacks for Bitcoin-secured immutability and build a future where patients truly own their health data!