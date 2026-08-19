# Troubleshooting MySQL WinError 10061 (Error 2003)

`MySQL Error 2003` with a message such as `[WinError 10061] No connection could be made because the target machine actively refused it` means that the FastAPI backend reached the local machine, but nothing accepted the MySQL connection on the requested host and port. The most common causes are that MySQL is stopped or is listening on a different port.

This project uses the following local development connection by default:

```text
mysql+pymysql://root:@127.0.0.1:3306/campusmarket_db
```

That means:

- Host: `127.0.0.1` (this computer)
- Port: `3306`
- User: `root`
- Password: empty by default in this project
- Database: `campusmarket_db`

## 1. Start MySQL in XAMPP

1. Open **XAMPP Control Panel**.
2. Find the **MySQL** row.
3. Click **Start**.
4. Confirm that the row turns green and shows a **Stop** button. The XAMPP log should also indicate that MySQL started.
5. Leave XAMPP running while testing the FastAPI backend.

If MySQL stops immediately, click **Logs** in XAMPP and inspect the MySQL error log. A port conflict is a common reason for an immediate stop. Another MySQL, MariaDB, or database service may already be using the configured port.

## 2. Verify the configured port

The default MySQL port is `3306`, but XAMPP may be configured to use another port.

### Check the XAMPP configuration

1. In XAMPP, click **Config** on the **MySQL** row.
2. Open `my.ini`.
3. Search for `port=` in the `[client]` and `[mysqld]` sections.
4. Confirm the server port is `3306`.
5. If it is another value, use that value in the backend connection URL and in the checks below.

### Check whether Windows is listening on port 3306

Run this in PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 3306 -State Listen
```

A listening entry confirms that a process has opened port `3306`; it does not by itself prove that the process is the expected MySQL server.

You can also test the port directly:

```powershell
Test-NetConnection 127.0.0.1 -Port 3306
```

Look for:

```text
TcpTestSucceeded : True
```

If it is `False`, start MySQL in XAMPP or correct the port. To identify a process that owns the port, run:

```powershell
netstat -ano | findstr :3306
```

Then match the PID with **Task Manager** or:

```powershell
Get-Process -Id <PID>
```

## 3. Confirm the database exists

A running MySQL service can still fail during FastAPI startup if the configured database does not exist. Open XAMPP's **Shell** or another MySQL client and run:

```sql
CREATE DATABASE IF NOT EXISTS campusmarket_db;
```

You can verify it with:

```sql
SHOW DATABASES;
```

If MySQL has a root password, test it explicitly from a terminal:

```powershell
mysql -h 127.0.0.1 -P 3306 -u root -p
```

Enter the password when prompted, then select the database:

```sql
USE campusmarket_db;
```

An empty XAMPP root password is common in local installations, but it is not universal. Do not assume it is empty if you changed it or if your XAMPP installation configured one.

## 4. Match the FastAPI connection settings

The backend reads `DATABASE_URL` first. If it is not set, it falls back to the local XAMPP URL shown at the top of this guide. Check whether a stale environment variable is overriding the expected settings:

```powershell
$env:DATABASE_URL
$env:DB_HOST
$env:DB_PORT
$env:DB_USER
$env:DB_PASSWORD
$env:DB_NAME
```

For a MySQL server using a password, set a complete URL before starting Uvicorn. URL-encode special characters in the password, such as `@`, `:`, `/`, or `#`.

```powershell
$env:DATABASE_URL = "mysql+pymysql://root:YOUR_PASSWORD@127.0.0.1:3306/campusmarket_db"
```

The backend also defines these component variables for compatibility with other environments, but its current fallback URL remains the explicit local XAMPP URL. For this project, use `DATABASE_URL` when you need to change the host, port, user, password, or database:

```powershell
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3306"
$env:DB_USER = "root"
$env:DB_PASSWORD = ""
$env:DB_NAME = "campusmarket_db"
```

Use the actual values from `my.ini` and your MySQL user account. `127.0.0.1` avoids ambiguity between IPv4 and IPv6 resolution that can sometimes occur with `localhost`.

## 5. Start the backend from the correct directory

From the repository's `Backend` directory, activate the backend environment and start Uvicorn:

```powershell
cd C:\Users\mau\Documents\Campus-market\Backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

On startup, this application calls `init_db()`, which creates missing tables. Therefore, the database connection must work before the API can finish starting. A successful startup should not print a SQLAlchemy `OperationalError` or a PyMySQL connection-refused traceback.

Open the API after startup:

```text
http://127.0.0.1:8000/docs
```

## 6. Diagnose the remaining error

- **`WinError 10061` / `Can't connect to MySQL server`**: MySQL is stopped, the host is wrong, or no process is listening on the selected port.
- **`Can't connect ... (using password: YES)`**: The server is reachable, but the username or password is probably wrong.
- **`Unknown database 'campusmarket_db'`**: Create the database or correct `DB_NAME` / `DATABASE_URL`.
- **`Access denied for user`**: Fix the MySQL account, password, host permission, or URL encoding.
- **`ModuleNotFoundError: No module named 'pymysql'`**: Activate the backend virtual environment and run `pip install -r requirements.txt`.
- **The port is occupied and XAMPP cannot start MySQL**: Stop the conflicting service or change the XAMPP MySQL port, then update the backend URL to match.

## Quick recovery checklist

1. MySQL is green and running in XAMPP.
2. XAMPP's `my.ini` confirms the server port.
3. `Test-NetConnection 127.0.0.1 -Port 3306` succeeds, or the configured alternate port is used.
4. `campusmarket_db` exists.
5. The credentials in `DATABASE_URL` match the MySQL account.
6. `pymysql` is installed in the active FastAPI environment.
7. Uvicorn is started from `Backend` with `uvicorn app.main:app --reload`.
