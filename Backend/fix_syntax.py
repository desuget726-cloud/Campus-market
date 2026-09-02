#!/usr/bin/env python
"""Fix the missing closing brace in main.py"""

with open('app/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the missing closing brace after dev_mode
content = content.replace(
    '"dev_mode": False,\n\n\n@app.post("/api/auth/verify-reset-code")',
    '"dev_mode": False,\n    }\n\n\n@app.post("/api/auth/verify-reset-code")'
)

with open('app/main.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('✓ Fixed missing closing brace')
