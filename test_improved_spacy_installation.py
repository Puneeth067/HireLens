#!/usr/bin/env python3
"""
Test script to verify the improved spaCy model installation approach
"""

import sys
import subprocess
import importlib

def test_improved_spacy_installation():
    """Test the improved spaCy installation approach"""
    print("Testing improved spaCy model installation approach...")
    
    try:
        # Try to import spacy
        import spacy
        print("✓ spaCy imported successfully")
        
        # Try to load the English model
        try:
            nlp = spacy.load("en_core_web_sm")
            print("✓ spaCy English model loaded successfully")
            return True
        except OSError:
            print(" spaCy English model not found, testing installation methods...")
            
            # Test direct pip installation (primary method)
            print("  Testing direct pip installation...")
            try:
                result = subprocess.run([
                    sys.executable, "-m", "pip", "install", 
                    "https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl"
                ], check=True, capture_output=True, text=True, timeout=300)
                
                print("  ✓ spaCy English model installed via pip successfully")
                
                # Try to load again after installation
                _ = importlib.reload(spacy)
                nlp = spacy.load("en_core_web_sm")
                print("  ✓ spaCy English model loaded successfully after installation")
                
                # Test the model
                doc = nlp("This is a test sentence for spaCy.")
                print(f"  ✓ Model working correctly. Processed {len(doc)} tokens")
                
                return True
                
            except Exception as e:
                print(f"  ✗ Direct pip installation failed: {e}")
                
                # Test fallback method (spacy download)
                print("  Testing fallback method (spacy download)...")
                try:
                    result = subprocess.run([
                        sys.executable, "-m", "spacy", "download", "en_core_web_sm"
                    ], check=True, capture_output=True, text=True, timeout=300)
                    
                    print("  ✓ spaCy English model installed via spacy download successfully")
                    
                    # Try to load again after installation
                    _ = importlib.reload(spacy)
                    nlp = spacy.load("en_core_web_sm")
                    print("  ✓ spaCy English model loaded successfully after installation")
                    
                    # Test the model
                    doc = nlp("This is a test sentence for spaCy.")
                    print(f"  ✓ Model working correctly. Processed {len(doc)} tokens")
                    
                    return True
                    
                except Exception as e2:
                    print(f"  ✗ Fallback method also failed: {e2}")
                    return False
                    
    except ImportError as e:
        print(f"✗ Failed to import spaCy: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    print("Improved spaCy Installation Test")
    print("=" * 35)
    
    if test_improved_spacy_installation():
        print("\n🎉 All tests passed! The improved installation approach works correctly.")
        sys.exit(0)
    else:
        print("\n❌ Tests failed. There may be an issue with the installation approach.")
        sys.exit(1)