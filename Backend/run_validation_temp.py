import subprocess
import os

backend_dir = r"c:\Users\Lab 3\Documents\Campus-market\Backend"
cmd = [
    os.path.join(backend_dir, 'venv', 'Scripts', 'python.exe'),
    '-m',
    'py_compile',
    os.path.join('app', 'main.py'),
]
print('---COMPILE---')
res_compile = subprocess.run(cmd, cwd=backend_dir, capture_output=True, text=True)
print(res_compile.stdout, end='')
print(res_compile.stderr, end='')
print(f'COMPILE_EXIT={res_compile.returncode}')

print('---UNITTEST---')
cmd = [
    os.path.join(backend_dir, 'venv', 'Scripts', 'python.exe'),
    '-m',
    'unittest',
    'discover',
    '-s',
    'tests',
    '-p',
    'test_*.py',
]
res_tests = subprocess.run(cmd, cwd=backend_dir, capture_output=True, text=True)
print(res_tests.stdout, end='')
print(res_tests.stderr, end='')
print(f'UNITTEST_EXIT={res_tests.returncode}')
