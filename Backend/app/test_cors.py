import requests

API_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://127.0.0.1:5173"

def test_cors():
    print("🔍 CORS Diagnostic Check\n")
    
    # Test 1: Server connectivity
    try:
        response = requests.get(f"{API_URL}/api/categories")
        print(f"✓ Backend connection: OK (Status {response.status_code})")
    except Exception as e:
        print(f"✗ Backend connection: FAILED")
        print(f"  Make sure Uvicorn is running on port 8000")
        print(f"  Error: {e}\n")
        return
    
    # Test 2: Check CORS headers
    try:
        headers = {"Origin": FRONTEND_URL}
        response = requests.options(f"{API_URL}/api/categories", headers=headers)
        
        cors_origin = response.headers.get("access-control-allow-origin")
        cors_methods = response.headers.get("access-control-allow-methods")
        cors_creds = response.headers.get("access-control-allow-credentials")
        
        print(f"\n✓ CORS Headers:")
        print(f"  {'✓' if cors_origin else '✗'} Allow-Origin: {cors_origin}")
        print(f"  {'✓' if cors_methods else '✗'} Allow-Methods: {cors_methods}")
        print(f"  {'✓' if cors_creds else '✗'} Allow-Credentials: {cors_creds}")
        
        if cors_origin == FRONTEND_URL:
            print(f"\n✓ CORS configured correctly for {FRONTEND_URL}")
        else:
            print(f"\n⚠️  Expected origin '{FRONTEND_URL}', got '{cors_origin}'")
            
    except Exception as e:
        print(f"✗ CORS check failed: {e}\n")
    
    # Test 3: Colleges endpoint
    try:
        response = requests.get(f"{API_URL}/api/admin/colleges")
        colleges = response.json()
        print(f"✓ Colleges endpoint: OK ({len(colleges)} colleges loaded)")
    except Exception as e:
        print(f"✗ Colleges endpoint: FAILED - {e}\n")
    
    print("\n" + "="*50)
    print("All tests passed! Frontend can connect. ✓" if cors_origin == FRONTEND_URL else "Check CORS configuration.")

if __name__ == "__main__":
    test_cors()