# Security Settings Helper – FastAPI Implementation Guide

## Overview

The `SecuritySettings` dataclass and `get_security_settings()` helper centralize reading the six key security controls from `SystemSetting` with defensive type coercion and sensible defaults. All controls are now wired into the core authentication and registration flows.

---

## Data Model

### SecuritySettings (Dataclass)
```python
@dataclass(frozen=True)
class SecuritySettings:
    require_student_verification: bool        # Gate student registration & operations
    admin_2fa: bool                           # Enforce OTP on admin login
    max_login_attempts: int                   # Failed login threshold (e.g., 5)
    session_timeout: int                      # Session duration in minutes (e.g., 30)
    min_password_length: int                  # Minimum password chars (e.g., 8)
    audit_logging: bool                       # Enable/disable audit trail persistence
```

### LoginAttempt (SQLAlchemy Model)
```python
class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    identifier = Column(String(150), primary_key=True)  # Normalized username/email
    failed_attempts = Column(Integer, default=0)        # Count of failed attempts
    locked_until = Column(DateTime, nullable=True)      # Lockout expiry timestamp
    updated_at = Column(DateTime, ...)                  # Last update time
```

---

## Core Helper Functions

### 1. Read Security Settings
```python
def get_security_settings(db: Session) -> SecuritySettings:
    """
    Fetch all six security controls from SystemSetting with type normalization.
    Falls back to DEFAULT_SETTINGS_BLOCKS on missing or malformed values.
    """
```

**Usage:**
```python
@app.post("/api/register")
def register_student(student_data: StudentRegister, db: Session = Depends(get_db)):
    security = get_security_settings(db)  # Single read for all controls
    
    # Check password length
    if len(student_data.password) < security.min_password_length:
        raise HTTPException(status_code=400, 
            detail=f"Password must be at least {security.min_password_length} characters.")
    
    # Create student with verification status based on policy
    student = Student(
        name=student_data.name,
        email=student_data.email,
        password=hash_password(student_data.password),
        status="Pending Verification" if security.require_student_verification else "Active",
    )
    db.add(student)
    db.commit()
    
    return {
        "message": "Registration submitted for verification." if security.require_student_verification else "Success",
        "requires_verification": security.require_student_verification,
    }
```

---

### 2. Track Failed Login Attempts
```python
def _login_identifier(value: str) -> str:
    """Normalize login identifier to lowercase for consistent tracking."""
    return str(value or "").strip().lower()

def _check_login_lock(db: Session, identifier: str, settings: SecuritySettings) -> None:
    """
    Verify if identifier is rate-limited.
    Raises HTTPException(429) if locked_until > now.
    """

def _record_failed_login(db: Session, identifier: str, settings: SecuritySettings) -> None:
    """
    Increment failed attempt count. Lock account if count >= max_login_attempts.
    Lockout duration = session_timeout minutes.
    """

def _reset_login_attempts(db: Session, identifier: str) -> None:
    """Clear attempt record on successful login."""
```

**Usage in Login Endpoint:**
```python
@app.post("/api/login")
def login_user(data: LoginRequest, db: Session = Depends(get_db)):
    security = get_security_settings(db)
    identifier = _login_identifier(data.id_or_email)
    
    # Step 1: Check if account is locked due to failed attempts
    _check_login_lock(db, identifier, security)
    
    # Step 2: Try admin login
    admin = db.query(Admin).filter(
        (Admin.username == data.id_or_email) | (Admin.email == data.id_or_email)
    ).first()
    
    if admin and verify_password(data.password, admin.password_hash):
        _reset_login_attempts(db, identifier)  # Clear failed attempts on success
        
        # Step 3: Check if 2FA is required
        if security.admin_2fa:
            otp = f"{random.randint(100000, 999999)}"
            db.add(PasswordReset(
                email=admin.email,
                otp_code=otp,
                expires_at=datetime.utcnow() + timedelta(minutes=10),
            ))
            db.commit()
            send_otp_email(admin.email, otp)
            return {
                "role": "admin",
                "requires_2fa": True,
                "otp_email": admin.email,
            }
        
        # Step 4: Generate session token with configured timeout
        session_secret = os.getenv("SESSION_SECRET", "campace-session-secret")
        token = _create_session_token(
            admin.username, "admin", 
            security.session_timeout,  # Use dynamic timeout
            session_secret
        )
        return {"role": "admin", "access_token": token, ...}
    
    # Step 5: Try student login
    student = db.query(Student).filter(
        (Student.student_id == data.id_or_email) | (Student.email == data.id_or_email)
    ).first()
    
    if student and verify_password(data.password, student.password):
        # Step 6: Gate login if verification is required and student not verified
        if security.require_student_verification and not student.is_verified:
            _record_failed_login(db, identifier, security)
            raise HTTPException(status_code=403, 
                detail="Student verification is required before login.")
        
        _reset_login_attempts(db, identifier)
        token = _create_session_token(
            student.student_id, "student", 
            security.session_timeout,
            session_secret
        )
        return {"role": "student", "access_token": token, ...}
    
    # Step 7: Record failed attempt and lock if threshold reached
    _record_failed_login(db, identifier, security)
    raise HTTPException(status_code=400, detail="Invalid ID/Email or Password.")
```

---

### 3. Restrict Student Operations
```python
# Product creation restricted if student not verified
@app.post("/api/products")
def create_product(..., db: Session = Depends(get_db)):
    security = get_security_settings(db)
    
    if security.require_student_verification and not student.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Unverified profiles are restricted from creating listings.",
        )
    ...
```

---

### 4. Enable/Disable Database Audit Logging
```python
def _audit_logging_enabled(db: Session) -> bool:
    """Check if audit logging is enabled in security settings."""
    return get_security_settings(db).audit_logging

def _add_audit_log(db: Session, **values) -> None:
    """Only persist audit log if auditLogging is enabled."""
    if _audit_logging_enabled(db):
        db.add(AuditLog(**values))
```

**Usage:**
```python
@app.put("/api/admin/settings")
def update_admin_settings(payload: dict, db: Session = Depends(get_db)):
    security = get_security_settings(db)
    
    # Save settings...
    
    # Record audit only if enabled
    admin = db.query(Admin).first()
    if admin and security.audit_logging:
        db.add(AuditLog(
            admin_id=admin.id,
            action="System Settings Updated",
            entity_type="Settings",
            description=json.dumps({
                "username": admin.username,
                "old_values": previous_settings,
                "new_values": new_settings,
            }),
            status="SUCCESS",
        ))
    db.commit()
```

---

## SystemSetting Schema

All controls are stored in a single JSON block under `key='security'`:

```python
DEFAULT_SETTINGS_BLOCKS["security"] = {
    "requireStudentVerification": True,    # bool: Gate unverified students
    "admin2FA": True,                      # bool: Enforce OTP on admin login
    "maxLoginAttempts": 5,                 # int: Lockout threshold
    "sessionTimeout": 30,                  # int: Session duration (minutes)
    "minPasswordLength": 8,                # int: Minimum password length
    "auditLogging": True,                  # bool: Enable audit trail
}
```

**Storage in Database:**
```sql
INSERT INTO system_settings (key, value) VALUES (
    'security',
    '{"requireStudentVerification": true, "admin2FA": true, "maxLoginAttempts": 5, ...}'
);
```

---

## Runtime Behavior

### Scenario 1: Student Registration with Verification Required
1. `register_student()` reads `security.require_student_verification = True`
2. Student is saved with `status = "Pending Verification"`
3. Response includes `"requires_verification": True`
4. Student cannot log in until admin approves verification (`Student.is_verified = True`)

### Scenario 2: Admin Login with 2FA Enabled
1. `login_user()` reads `security.admin_2fa = True`
2. Admin password verified; OTP generated and emailed
3. Response includes `"requires_2fa": True`
4. Admin must call `/api/login/verify-otp` with the received OTP
5. Only then is session token issued

### Scenario 3: Failed Login Attempt Lockout
1. Student attempts login with wrong password
2. `_record_failed_login()` increments `LoginAttempt.failed_attempts`
3. After 5 failed attempts (if `max_login_attempts = 5`):
   - `LoginAttempt.locked_until` is set to now + 30 minutes
   - Next login attempt triggers `_check_login_lock()` → HTTP 429
4. After 30 minutes, lockout expires; attempts can resume

### Scenario 4: Session Token Lifetime
1. `_create_session_token()` is called with `exp = now + session_timeout` (in minutes)
2. Token issued with expiry = current_time + 30 minutes
3. After 30 minutes, token is invalid; student must re-login

### Scenario 5: Audit Logging Disabled
1. Admin disables `auditLogging = False` in settings
2. All calls to `_add_audit_log()` or `_audit_logging_enabled()` return False
3. No audit logs are persisted to the database (append-only listener also blocks deletions)

---

## Integration Points

| Control | Endpoint | Behavior |
|---------|----------|----------|
| `requireStudentVerification` | POST /api/register | Sets initial status |
| `requireStudentVerification` | POST /api/login | Blocks unverified login |
| `requireStudentVerification` | POST /api/products | Blocks product creation |
| `admin2FA` | POST /api/login | Triggers OTP flow |
| `maxLoginAttempts` | POST /api/login | Increments & locks after threshold |
| `sessionTimeout` | POST /api/login | Sets token expiry |
| `minPasswordLength` | POST /api/register | Validates password |
| `minPasswordLength` | POST /api/auth/reset-password | Validates new password |
| `auditLogging` | All admin actions | Filters audit log inserts |

---

## Development Notes

### Type Safety
- `SecuritySettings` is a frozen dataclass; all values are normalized at read time
- Boolean strings ("true", "1", "yes") are coerced via `_setting_bool()`
- Integer strings are coerced and bounded (min=1) via `positive_int()` helper
- Missing settings fall back to `DEFAULT_SETTINGS_BLOCKS["security"]`

### Database Consistency
- `LoginAttempt` primary key is the normalized identifier (lowercase, trimmed)
- Lockout duration equals `session_timeout` minutes (defensive: ensures timeout covers lockout)
- Failed attempt record is deleted on successful login

### Audit Logging
- Existing `before_flush` SQLAlchemy event listener respects `audit_logging` setting
- If disabled, new audit logs are expunged before commit
- Deletion/modification attempts are logged as security events regardless of setting

---

## Example: Full Usage in FastAPI Route

```python
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status

@app.post("/api/secure-operation")
def secure_operation(db: Session = Depends(get_db)):
    """
    Complete example: read settings, check auth, audit, return dynamic response.
    """
    # Step 1: Load all six security controls in one call
    security = get_security_settings(db)
    
    # Step 2: Conditional password validation
    user_password = "MyNewPassword123"
    if len(user_password) < security.min_password_length:
        raise HTTPException(
            status_code=400,
            detail=f"Password too short. Minimum: {security.min_password_length}"
        )
    
    # Step 3: Check user verification if required
    user = db.query(Student).first()
    if security.require_student_verification and not user.is_verified:
        raise HTTPException(status_code=403, detail="Verification required.")
    
    # Step 4: Perform operation
    result = perform_operation(user)
    
    # Step 5: Audit only if enabled
    if security.audit_logging:
        db.add(AuditLog(
            admin_id=None,
            action="Secure Operation Completed",
            entity_type="Student",
            entity_id=user.id,
            description=f"Student {user.student_id} completed secure operation.",
            status="SUCCESS",
        ))
    db.commit()
    
    return {
        "success": True,
        "message": result,
        "audit_enabled": security.audit_logging,
        "verification_required": security.require_student_verification,
    }
```

---

## Testing Checklist

- [ ] Read `SecuritySettings` from database without errors
- [ ] Registration creates "Pending Verification" status when enabled
- [ ] Login blocks unverified students when enabled
- [ ] Admin 2FA triggers OTP email when enabled
- [ ] Failed login attempts increment counter
- [ ] Account locks after N failed attempts
- [ ] Lockout expires after session_timeout minutes
- [ ] Password validation enforces min_password_length
- [ ] Audit logs appear when audit_logging = true
- [ ] Audit logs suppressed when audit_logging = false
- [ ] Session token expiry matches session_timeout

