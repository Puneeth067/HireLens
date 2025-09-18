#!/usr/bin/env python3

import requests
import json

# Test job creation API
def test_job_creation():
    url = "http://localhost:8000/api/jobs"
    
    job_data = {
        "title": "Senior Software Engineer",
        "company": "Tech Corp",
        "location": "San Francisco, CA",
        "job_type": "full_time",
        "experience_level": "middle",
        "description": "We are looking for a senior software engineer to join our team.",
        "salary_min": 80000,
        "salary_max": 120000,
        "required_skills": ["Python", "JavaScript", "React"],
        "preferred_skills": ["Docker", "AWS"],
        "responsibilities": ["Develop web applications", "Code reviews", "Mentoring"],
        "requirements": ["Bachelor's degree", "3+ years experience"],
        "weight_skills": 0.4,
        "weight_experience": 0.3,
        "weight_education": 0.2,
        "weight_keywords": 0.1
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        print("Creating job...")
        response = requests.post(url, json=job_data, headers=headers)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {response.headers}")
        
        if response.status_code == 200:
            result = response.json()
            print("Job created successfully!")
            print(f"Job ID: {result.get('id')}")
            print(f"Job Title: {result.get('title')}")
            return result.get('id')
        else:
            print("Failed to create job:")
            print(f"Error: {response.text}")
            return None
            
    except Exception as e:
        print(f"Request failed: {e}")
        return None

def test_list_jobs():
    url = "http://localhost:8000/api/jobs"
    
    try:
        print("\nListing jobs...")
        response = requests.get(url)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Total jobs: {result.get('total', 0)}")
            jobs = result.get('jobs', [])
            for job in jobs:
                print(f"- {job.get('title')} at {job.get('company')}")
        else:
            print("Failed to list jobs:")
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    job_id = test_job_creation()
    test_list_jobs()