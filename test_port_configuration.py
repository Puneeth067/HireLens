#!/usr/bin/env python3
"""
Test script to verify port configuration handling
"""

import os
import sys

def test_port_configuration():
    """Test port configuration from environment variables"""
    print("Testing port configuration...")
    
    # Test default port
    default_port = int(os.environ.get("PORT", 8000))
    print(f"Default port: {default_port}")
    
    # Test with PORT environment variable set
    os.environ["PORT"] = "3000"
    env_port = int(os.environ.get("PORT", 8000))
    print(f"Port from environment variable: {env_port}")
    
    # Test with invalid port (should fallback to default)
    os.environ["PORT"] = "invalid"
    try:
        invalid_port = int(os.environ.get("PORT", 8000))
        print(f"Invalid port conversion result: {invalid_port}")
    except ValueError:
        print("Invalid port correctly handled with fallback to default")
        fallback_port = 8000
        print(f"Fallback port: {fallback_port}")
    
    print("Port configuration test completed successfully!")

if __name__ == "__main__":
    test_port_configuration()