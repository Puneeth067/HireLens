#!/usr/bin/env python3
"""
Script to create test comparison data for HireLens
"""

import json
import uuid
from datetime import datetime, timedelta
import random
from pathlib import Path

# Create comparisons directory if it doesn't exist
comparisons_dir = Path("server/uploads/comparisons")
comparisons_dir.mkdir(exist_ok=True)

# Load existing jobs
jobs_file = Path("server/uploads/jobs/jobs.json")
if not jobs_file.exists():
    print("Jobs file not found. Please create some jobs first.")
    exit(1)

with open(jobs_file, 'r') as f:
    jobs_data = json.load(f)
    jobs = jobs_data.get('jobs', [])

if not jobs:
    print("No jobs found. Please create some jobs first.")
    exit(1)

# Load existing parsed resumes
resumes_dir = Path("server/uploads/parsed_resumes")
if not resumes_dir.exists():
    print("Parsed resumes directory not found.")
    exit(1)

resume_files = list(resumes_dir.glob("*.json"))
if not resume_files:
    print("No parsed resumes found.")
    exit(1)

# Sample skills for testing
sample_skills = [
    "Python", "JavaScript", "React", "Node.js", "Java", "C++", "SQL", "MongoDB",
    "Docker", "Kubernetes", "AWS", "Azure", "Machine Learning", "Data Analysis",
    "Project Management", "Communication", "Team Leadership", "Agile", "Scrum"
]

# Create sample comparisons
comparisons = []

# Use the first job for all comparisons
job = jobs[0]

for i, resume_file in enumerate(resume_files[:3]):  # Create 3 comparisons
    # Load resume data
    with open(resume_file, 'r') as f:
        resume_data = json.load(f)
    
    # Create a comparison record
    comparison_id = str(uuid.uuid4())
    resume_id = resume_data.get('file_id', str(uuid.uuid4()))
    
    # Random scores for testing
    overall_score = random.randint(60, 95)
    skills_score = random.randint(50, 100)
    experience_score = random.randint(40, 90)
    education_score = random.randint(30, 85)
    keywords_score = random.randint(45, 95)
    
    # Random status
    statuses = ['completed', 'processing', 'failed']
    status = random.choice(statuses) if i > 0 else 'completed'  # First one always completed
    
    # Create comparison record
    comparison = {
        "id": comparison_id,
        "resume_id": resume_id,
        "job_id": job['id'],
        "resume_filename": resume_data.get('filename', f'resume_{i+1}.pdf'),
        "candidate_name": f"Candidate {chr(65+i)}",
        "job_title": job['title'],
        "company": job['company'],
        "ats_score": {
            "overall_score": overall_score,
            "skills_score": skills_score,
            "experience_score": experience_score,
            "education_score": education_score,
            "keywords_score": keywords_score,
            "recommendations": [
                "Add more relevant keywords to your resume",
                "Highlight your experience with required technologies",
                "Include more specific examples of your achievements"
            ],
            "matched_skills": random.sample(sample_skills, random.randint(3, 7)),
            "missing_skills": random.sample(sample_skills, random.randint(2, 5)),
            "keyword_matches": random.sample(sample_skills, random.randint(4, 8)),
            "created_at": datetime.now().isoformat()
        } if status == 'completed' else None,
        "status": status,
        "error_message": "Processing failed due to parsing error" if status == 'failed' else None,
        "created_at": (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
        "updated_at": datetime.now().isoformat(),
        "completed_at": datetime.now().isoformat() if status == 'completed' else None,
        "processing_time_seconds": random.randint(5, 30) if status == 'completed' else None
    }
    
    comparisons.append(comparison)

# Save comparisons to file
comparisons_file = comparisons_dir / "comparisons.json"
comparisons_data = {
    "comparisons": comparisons,
    "last_updated": datetime.now().isoformat()
}

with open(comparisons_file, 'w') as f:
    json.dump(comparisons_data, f, indent=2)

print(f"Created {len(comparisons)} test comparisons")
print(f"Data saved to {comparisons_file}")