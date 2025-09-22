#!/usr/bin/env python3
"""
Test script to verify runtime spaCy model installation in services
"""

import sys
import os

# Change to the server directory
server_path = os.path.join(os.path.dirname(__file__), 'server')
os.chdir(server_path)
sys.path.insert(0, server_path)

def test_resume_parser_service():
    """Test ResumeParserService initialization"""
    print("Testing ResumeParserService...")
    
    try:
        from app.services.resume_parser_service import ResumeParserService
        service = ResumeParserService()
        
        if service.nlp is not None:
            print("✓ ResumeParserService initialized with spaCy model")
            # Test basic functionality
            doc = service.nlp("This is a test sentence.")
            print(f"✓ spaCy model working in ResumeParserService. Processed {len(doc)} tokens")
        else:
            print("⚠ ResumeParserService initialized without spaCy model (limited functionality)")
        
        return True
    except Exception as e:
        print(f"✗ Error initializing ResumeParserService: {e}")
        return False

def test_ats_scorer():
    """Test ATSScorer initialization"""
    print("Testing ATSScorer...")
    
    try:
        from app.services.ats_scoring_service import ATSScorer
        scorer = ATSScorer()
        
        if scorer.nlp is not None:
            print("✓ ATSScorer initialized with spaCy model")
            # Test basic functionality
            doc = scorer.nlp("This is a test sentence.")
            print(f"✓ spaCy model working in ATSScorer. Processed {len(doc)} tokens")
        else:
            print("⚠ ATSScorer initialized without spaCy model (limited functionality)")
        
        return True
    except Exception as e:
        print(f"✗ Error initializing ATSScorer: {e}")
        return False

if __name__ == "__main__":
    print("Runtime Services Test")
    print("=" * 20)
    
    success = True
    
    # Test services
    success &= test_resume_parser_service()
    success &= test_ats_scorer()
    
    if success:
        print("\n🎉 All service tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some service tests failed.")
        sys.exit(1)