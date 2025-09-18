# tests/test_job_service.py - Unit tests for job service

import pytest
import json
import os
import tempfile
from datetime import datetime
from unittest.mock import patch, mock_open
from pathlib import Path

from app.services.job_service import JobService
from app.models.job import (
    JobDescriptionCreate, 
    JobDescriptionUpdate, 
    JobStatus, 
    JobType, 
    ExperienceLevel
)


class TestJobService:
    """Test cases for JobService"""
    
    @pytest.fixture
    def temp_jobs_file(self):
        """Create a temporary jobs file for testing"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            initial_data = {
                "jobs": [],
                "metadata": {
                    "created_at": datetime.now().isoformat(),
                    "last_updated": datetime.now().isoformat(),
                    "total_jobs": 0
                }
            }
            json.dump(initial_data, f)
            temp_file = f.name
        
        yield temp_file
        
        # Cleanup
        if os.path.exists(temp_file):
            os.unlink(temp_file)
    
    @pytest.fixture
    def job_service(self, temp_jobs_file):
        """Create JobService instance with temporary file"""
        with patch.object(JobService, 'jobs_file', temp_jobs_file):
            yield JobService()
    
    @pytest.fixture
    def sample_job_data(self):
        """Sample job data for testing"""
        return JobDescriptionCreate(
            title="Senior Python Developer",
            company="TechCorp Inc",
            department="Engineering",
            location="San Francisco, CA",
            job_type=JobType.FULL_TIME,
            experience_level=ExperienceLevel.SENIOR,
            description="We are looking for a senior Python developer...",
            responsibilities=[
                "Develop and maintain Python applications",
                "Code review and mentoring",
                "System architecture design"
            ],
            requirements=[
                "5+ years of Python experience",
                "Experience with Django/FastAPI",
                "Strong problem-solving skills"
            ],
            required_skills=["Python", "Django", "PostgreSQL", "Docker"],
            preferred_skills=["AWS", "Redis", "Elasticsearch"],
            salary_min=120000,
            salary_max=160000,
            currency="USD",
            weight_skills=0.4,
            weight_experience=0.3,
            weight_education=0.2,
            weight_keywords=0.1
        )
    
    def test_ensure_jobs_file_creates_file(self, job_service):
        """Test that ensure_jobs_file creates the file structure"""
        # Remove the file to test creation
        if os.path.exists(job_service.jobs_file):
            os.unlink(job_service.jobs_file)
        
        job_service.ensure_jobs_file()
        
        assert os.path.exists(job_service.jobs_file)
        
        with open(job_service.jobs_file, 'r') as f:
            data = json.load(f)
            assert "jobs" in data
            assert "metadata" in data
            assert data["jobs"] == []
            assert data["metadata"]["total_jobs"] == 0
    
    def test_create_job_success(self, job_service, sample_job_data):
        """Test successful job creation"""
        job = job_service.create_job(sample_job_data)
        
        assert job.id is not None
        assert job.title == sample_job_data.title
        assert job.company == sample_job_data.company
        assert job.status == JobStatus.DRAFT
        assert job.created_at is not None
        assert job.updated_at is not None
    
    def test_create_job_validates_weights(self, job_service, sample_job_data):
        """Test that job creation validates weight sum"""
        # Set weights that don't sum to 1.0
        sample_job_data.weight_skills = 0.5
        sample_job_data.weight_experience = 0.5
        sample_job_data.weight_education = 0.5
        sample_job_data.weight_keywords = 0.5
        
        with pytest.raises(ValueError, match="Weights must sum to 1.0"):
            job_service.create_job(sample_job_data)
    
    def test_get_job_success(self, job_service, sample_job_data):
        """Test successful job retrieval"""
        created_job = job_service.create_job(sample_job_data)
        retrieved_job = job_service.get_job(created_job.id)
        
        assert retrieved_job.id == created_job.id
        assert retrieved_job.title == created_job.title
    
    def test_get_job_not_found(self, job_service):
        """Test job retrieval with non-existent ID"""
        with pytest.raises(ValueError, match="Job not found"):
            job_service.get_job("non-existent-id")
    
    def test_update_job_success(self, job_service, sample_job_data):
        """Test successful job update"""
        created_job = job_service.create_job(sample_job_data)
        
        update_data = JobDescriptionUpdate(
            title="Lead Python Developer",
            salary_max=180000
        )
        
        updated_job = job_service.update_job(created_job.id, update_data)
        
        assert updated_job.title == "Lead Python Developer"
        assert updated_job.salary_max == 180000
        assert updated_job.salary_min == sample_job_data.salary_min  # Unchanged
        assert updated_job.updated_at > created_job.updated_at
    
    def test_update_job_not_found(self, job_service):
        """Test job update with non-existent ID"""
        update_data = JobDescriptionUpdate(title="Updated Title")
        
        with pytest.raises(ValueError, match="Job not found"):
            job_service.update_job("non-existent-id", update_data)
    
    def test_delete_job_success(self, job_service, sample_job_data):
        """Test successful job deletion"""
        created_job = job_service.create_job(sample_job_data)
        
        result = job_service.delete_job(created_job.id)
        assert result is True
        
        with pytest.raises(ValueError, match="Job not found"):
            job_service.get_job(created_job.id)
    
    def test_delete_job_not_found(self, job_service):
        """Test job deletion with non-existent ID"""
        result = job_service.delete_job("non-existent-id")
        assert result is False
    
    def test_list_jobs_with_pagination(self, job_service, sample_job_data):
        """Test job listing with pagination"""
        # Create multiple jobs
        jobs = []
        for i in range(5):
            job_data = sample_job_data.copy()
            job_data.title = f"Developer {i}"
            jobs.append(job_service.create_job(job_data))
        
        # Test first page
        result = job_service.list_jobs(page=1, per_page=2)
        
        assert result.total == 5
        assert len(result.jobs) == 2
        assert result.page == 1
        assert result.per_page == 2
        assert result.total_pages == 3
    
    def test_list_jobs_with_filters(self, job_service, sample_job_data):
        """Test job listing with filters"""
        # Create jobs with different statuses
        active_job_data = sample_job_data.copy()
        active_job_data.title = "Active Job"
        active_job = job_service.create_job(active_job_data)
        job_service.update_job_status(active_job.id, JobStatus.ACTIVE)
        
        draft_job_data = sample_job_data.copy()
        draft_job_data.title = "Draft Job"
        job_service.create_job(draft_job_data)
        
        # Filter by active status
        result = job_service.list_jobs(status=JobStatus.ACTIVE)
        
        assert result.total == 1
        assert result.jobs[0].title == "Active Job"
        assert result.jobs[0].status == JobStatus.ACTIVE
    
    def test_list_jobs_with_search(self, job_service, sample_job_data):
        """Test job listing with search"""
        # Create jobs with different titles
        python_job = sample_job_data.copy()
        python_job.title = "Python Developer"
        job_service.create_job(python_job)
        
        java_job = sample_job_data.copy()
        java_job.title = "Java Developer"
        java_job.required_skills = ["Java", "Spring", "MySQL"]
        job_service.create_job(java_job)
        
        # Search for Python
        result = job_service.list_jobs(search="Python")
        
        assert result.total == 1
        assert "Python" in result.jobs[0].title
    
    def test_get_job_stats(self, job_service, sample_job_data):
        """Test job statistics calculation"""
        # Create jobs with different statuses
        for i in range(3):
            job = job_service.create_job(sample_job_data)
            if i < 2:
                job_service.update_job_status(job.id, JobStatus.ACTIVE)
        
        stats = job_service.get_job_stats()
        
        assert stats.total_jobs == 3
        assert stats.active_jobs == 2
        assert stats.draft_jobs == 1
        assert stats.completed_jobs == 0
        assert stats.recent_jobs == 3
    
    def test_update_job_status(self, job_service, sample_job_data):
        """Test job status update"""
        job = job_service.create_job(sample_job_data)
        
        updated_job = job_service.update_job_status(job.id, JobStatus.ACTIVE)
        
        assert updated_job.status == JobStatus.ACTIVE
        assert updated_job.updated_at > job.updated_at
    
    def test_duplicate_job(self, job_service, sample_job_data):
        """Test job duplication"""
        original_job = job_service.create_job(sample_job_data)
        
        duplicated_job = job_service.duplicate_job(original_job.id)
        
        assert duplicated_job.id != original_job.id
        assert duplicated_job.title == f"Copy of {original_job.title}"
        assert duplicated_job.company == original_job.company
        assert duplicated_job.status == JobStatus.DRAFT
        assert duplicated_job.required_skills == original_job.required_skills
    
    def test_get_companies(self, job_service, sample_job_data):
        """Test getting unique companies"""
        # Create jobs with different companies
        companies = ["TechCorp", "DataCorp", "TechCorp", "AI Corp"]
        
        for company in companies:
            job_data = sample_job_data.copy()
            job_data.company = company
            job_service.create_job(job_data)
        
        result = job_service.get_companies()
        
        assert len(result) == 3  # Unique companies
        assert "TechCorp" in result
        assert "DataCorp" in result
        assert "AI Corp" in result
    
    def test_get_popular_skills(self, job_service, sample_job_data):
        """Test getting popular skills"""
        # Create jobs with overlapping skills
        skills_sets = [
            ["Python", "Django", "PostgreSQL"],
            ["Python", "FastAPI", "MongoDB"],
            ["JavaScript", "React", "Node.js"],
            ["Python", "Django", "Redis"]
        ]
        
        for skills in skills_sets:
            job_data = sample_job_data.copy()
            job_data.required_skills = skills
            job_service.create_job(job_data)
        
        popular_skills = job_service.get_popular_skills(limit=5)
        
        assert len(popular_skills) <= 5
        # Python should be most popular (appears in 3 jobs)
        assert popular_skills[0]["skill"] == "Python"
        assert popular_skills[0]["count"] == 3
    
    def test_file_corruption_handling(self, job_service):
        """Test handling of corrupted JSON file"""
        # Write invalid JSON to the file
        with open(job_service.jobs_file, 'w') as f:
            f.write("invalid json content")
        
        # Should recreate the file
        job_service.ensure_jobs_file()
        
        # Should be able to load jobs after recreation
        data = job_service.load_jobs()
        assert "jobs" in data
        assert data["jobs"] == []
    
    def test_concurrent_access_safety(self, job_service, sample_job_data):
        """Test thread safety of job operations"""
        import threading
        import time
        
        results = []
        errors = []
        
        def create_job_worker(worker_id):
            try:
                job_data = sample_job_data.copy()
                job_data.title = f"Concurrent Job {worker_id}"
                job = job_service.create_job(job_data)
                results.append(job.id)
            except Exception as e:
                errors.append(str(e))
        
        # Create multiple threads
        threads = []
        for i in range(5):
            thread = threading.Thread(target=create_job_worker, args=(i,))
            threads.append(thread)
        
        # Start all threads
        for thread in threads:
            thread.start()
        
        # Wait for completion
        for thread in threads:
            thread.join()
        
        # Verify results
        assert len(errors) == 0, f"Errors occurred: {errors}"
        assert len(results) == 5
        assert len(set(results)) == 5  # All IDs should be unique
    
    def test_validate_job_data(self, job_service):
        """Test job data validation and cleaning"""
        # Test with missing fields
        incomplete_data = {
            "title": "Test Job",
            "company": "Test Company"
            # Missing other required fields
        }
        
        validated_data = job_service._validate_job_data(incomplete_data)
        
        # Should have default values
        assert validated_data["location"] == ""
        assert validated_data["description"] == ""
        assert validated_data["responsibilities"] == []
        assert validated_data["requirements"] == []
        assert validated_data["required_skills"] == []
        assert validated_data["weight_skills"] == 0.4
        assert validated_data["weight_experience"] == 0.3
        assert validated_data["weight_education"] == 0.2
        assert validated_data["weight_keywords"] == 0.1


# Integration tests
class TestJobServiceIntegration:
    """Integration tests for JobService"""
    
    @pytest.fixture
    def real_job_service(self):
        """Create JobService with real file system"""
        # Use a temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            jobs_file = os.path.join(temp_dir, "test_jobs.json")
            with patch.object(JobService, 'jobs_file', jobs_file):
                yield JobService()
    
    def test_persistence_across_instances(self, real_job_service, sample_job_data):
        """Test that data persists across service instances"""
        # Create job with first instance
        job1 = real_job_service.create_job(sample_job_data)
        
        # Create new service instance (simulating restart)
        with patch.object(JobService, 'jobs_file', real_job_service.jobs_file):
            new_service = JobService()
            
            # Should be able to retrieve the job
            retrieved_job = new_service.get_job(job1.id)
            assert retrieved_job.id == job1.id
            assert retrieved_job.title == job1.title
    
    def test_bulk_operations_performance(self, real_job_service, sample_job_data):
        """Test performance of bulk operations"""
        import time
        
        start_time = time.time()
        
        # Create many jobs
        job_ids = []
        for i in range(50):
            job_data = sample_job_data.copy()
            job_data.title = f"Bulk Job {i}"
            job = real_job_service.create_job(job_data)
            job_ids.append(job.id)
        
        creation_time = time.time() - start_time
        
        # Retrieve all jobs
        start_time = time.time()
        result = real_job_service.list_jobs(per_page=100)
        retrieval_time = time.time() - start_time
        
        # Performance assertions (adjust thresholds as needed)
        assert creation_time < 5.0, f"Job creation took too long: {creation_time}s"
        assert retrieval_time < 1.0, f"Job retrieval took too long: {retrieval_time}s"
        assert result.total == 50
        assert len(result.jobs) == 50


if __name__ == "__main__":
    pytest.main([__file__])