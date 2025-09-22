#!/usr/bin/env python3
"""
Test script to verify spaCy model installation at runtime
"""

import sys
import subprocess
import importlib

def test_spacy_model():
    """Test if spaCy English model is properly installed"""
    print("Testing spaCy English model installation...")
    
    try:
        # Try to import spacy
        import spacy
        print("✓ spaCy imported successfully")
        
        # Try to load the English model
        nlp = spacy.load("en_core_web_sm")
        print("✓ spaCy English model loaded successfully")
        
        # Test the model with a simple sentence
        doc = nlp("This is a test sentence for spaCy.")
        print(f"✓ Model working correctly. Processed {len(doc)} tokens")
        
        # Print some basic info
        print(f"  Model pipeline: {nlp.pipe_names}")
        
        return True
        
    except ImportError as e:
        print(f"✗ Failed to import spaCy: {e}")
        return False
    except OSError as e:
        print(f"✗ Failed to load spaCy English model: {e}")
        print("  You may need to install the model with: python -m spacy download en_core_web_sm")
        return False
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        return False

def install_spacy_model():
    """Attempt to install the spaCy English model"""
    print("Attempting to install spaCy English model...")
    
    try:
        result = subprocess.run([
            sys.executable, "-m", "spacy", "download", "en_core_web_sm"
        ], check=True, capture_output=True, text=True, timeout=300)
        print("✓ spaCy English model installed successfully")
        print(f"  Output: {result.stdout}")
        return True
    except subprocess.TimeoutExpired:
        print("✗ spaCy model installation timed out")
        return False
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install spaCy model: {e}")
        print(f"  Error output: {e.stderr}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error during installation: {e}")
        return False

def ensure_spacy_model_runtime():
    """Ensure spaCy model is available, installing if necessary (runtime approach)"""
    print("Ensuring spaCy model is available (runtime approach)...")
    
    try:
        import spacy
        
        # Try to load the model
        try:
            nlp = spacy.load("en_core_web_sm")
            print("✓ spaCy English model already available")
            return nlp
        except OSError:
            print(" spaCy English model not found, installing at runtime...")
            if install_spacy_model():
                # Try to load again after installation
                _ = importlib.reload(spacy)  # Reload spacy module
                nlp = spacy.load("en_core_web_sm")
                print("✓ spaCy English model loaded successfully after installation")
                return nlp
            else:
                print("✗ Failed to install spaCy English model")
                return None
        except Exception as e:
            print(f"✗ Error loading spaCy model: {e}")
            return None
            
    except ImportError as e:
        print(f"✗ spaCy not installed: {e}")
        return None
    except Exception as e:
        print(f"✗ Unexpected error checking spaCy model: {e}")
        return None

if __name__ == "__main__":
    print("spaCy Model Runtime Installation Test")
    print("=" * 40)
    
    # Test the runtime approach
    nlp = ensure_spacy_model_runtime()
    
    if nlp is not None:
        # Test the model
        doc = nlp("This is a test sentence for spaCy.")
        print(f"✓ Model working correctly. Processed {len(doc)} tokens")
        print("\n🎉 All tests passed! spaCy is ready to use.")
        sys.exit(0)
    else:
        print("\n❌ spaCy model is not available and could not be installed.")
        sys.exit(1)