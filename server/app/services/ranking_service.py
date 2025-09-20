import json
import os
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime
from dataclasses import dataclass
import statistics
from ..models.ranking import RankingCriteria, RankedCandidate, CandidateRanking, RankingRequest
from ..services.comparison_service import ComparisonService
from ..models.comparison import ResumeJobComparison

@dataclass
class WeightedScore:
    score: float
    weight: float
    weighted_value: float

class RankingService:
    def __init__(self, job_service_instance: Any = None):
        self.data_dir = "data/rankings"
        os.makedirs(self.data_dir, exist_ok=True)
        # Pass the job_service_instance to ComparisonService
        self.comparison_service: ComparisonService = ComparisonService(job_service_instance=job_service_instance)
        # Store the job_service_instance for use in create_ranking
        self.job_service = job_service_instance
    
    def create_ranking(self, request: RankingRequest) -> CandidateRanking:
        """Create a new candidate ranking"""
        print(f"Creating ranking for job {request.job_id} with {len(request.resume_ids)} resume IDs")
        
        ranking_id = f"ranking_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Normalize criteria weights to ensure they sum to 1
        normalized_criteria = self._normalize_criteria_weights(request.criteria)
        print(f"Normalized criteria: skills={normalized_criteria.skills_weight}, "
              f"experience={normalized_criteria.experience_weight}, "
              f"education={normalized_criteria.education_weight}, "
              f"keywords={normalized_criteria.keyword_weight}")
        
        # Get comparisons for the job
        all_comparisons = self.comparison_service.get_comparisons_by_job(request.job_id)
        print(f"Found {len(all_comparisons)} existing comparisons for job {request.job_id}")
        
        # If no comparisons exist, create them automatically
        if not all_comparisons:
            print("No existing comparisons found, creating new ones automatically")
            
            # Get the job details using the stored job_service instance
            job = self.job_service.get_job(request.job_id) if self.job_service else None
            
            # If we couldn't get the job from the stored instance, try creating a new one
            if not job:
                from ..services.job_service import JobService
                job_service = JobService()
                job = job_service.get_job(request.job_id)
            
            if not job:
                raise ValueError(f"Job {request.job_id} not found")
            
            print(f"Job details: {job.title} ({job.id})")
            
            # If specific resume_ids are provided, create comparisons for those
            # Otherwise, if job.resumes exists, create comparisons for all of them
            # If neither exists, get all parsed resumes and create comparisons for those
            if request.resume_ids:
                resume_ids_to_process = request.resume_ids
                print(f"Using {len(resume_ids_to_process)} resume IDs from request")
            elif job.resumes:
                resume_ids_to_process = job.resumes
                print(f"Using {len(resume_ids_to_process)} resume IDs from job resumes")
            else:
                # Get all parsed resumes from the file service
                from ..services.file_service import FileService
                file_service = FileService()
                all_files = file_service.get_all_files()
                # Filter for files that have been successfully parsed
                resume_ids_to_process = [
                    file_info['file_id'] 
                    for file_info in all_files 
                    if file_info.get('status') == 'completed'
                ]
                print(f"Found {len(resume_ids_to_process)} parsed resumes to process from file service")
            
            if resume_ids_to_process:
                print(f"Creating comparisons for {len(resume_ids_to_process)} resumes")
                
                # Create comparisons for each resume
                created_comparisons = []
                failed_comparisons = []
                
                for resume_id in resume_ids_to_process:
                    try:
                        # Create comparison - this will be processed asynchronously
                        # Since the comparison service create_comparison is async, we need to handle it properly
                        # For now, let's just create the comparison record directly
                        from ..models.comparison import ResumeJobComparison, ComparisonStatus
                        import uuid
                        
                        # Validate resume and job exist
                        resume_data = self.comparison_service.file_service.get_parsed_data(resume_id)
                        if not resume_data:
                            raise ValueError(f"Resume not found: {resume_id}")
                        
                        job_data = self.job_service.get_job(request.job_id) if self.job_service else None
                        if not job_data:
                            from ..services.job_service import JobService
                            job_service = JobService()
                            job_data = job_service.get_job(request.job_id)
                            
                        if not job_data:
                            raise ValueError(f"Job not found: {request.job_id}")
                        
                        # Create comparison record
                        comparison_id = str(uuid.uuid4())
                        candidate_name = resume_data.get('parsed_data', {}).get('personal_info', {}).get('name', 'Unknown')
                        comparison = ResumeJobComparison(
                            id=comparison_id,
                            batch_id=None,
                            resume_id=resume_id,
                            job_id=request.job_id,
                            resume_filename=resume_data.get('filename', 'Unknown'),
                            candidate_name=candidate_name,
                            job_title=job_data.title,
                            company=job_data.company,
                            status=ComparisonStatus.PENDING,  # Will be updated when processed
                            ats_score=None,
                            completed_at=None,
                            processing_time_seconds=None,
                            error_message=None
                        )
                        
                        # Store in cache and save
                        self.comparison_service._comparison_cache[comparison_id] = comparison
                        self.comparison_service._save_comparisons()
                        
                        created_comparisons.append(comparison)
                        print(f"Created comparison {comparison_id} for resume {resume_id}")
                        
                        # Process comparison asynchronously
                        import asyncio
                        asyncio.create_task(self.comparison_service._process_comparison(comparison_id))
                        
                    except Exception as e:
                        # Log error but continue with other resumes
                        error_msg = f"Could not create comparison for resume {resume_id}: {str(e)}"
                        print(f"Warning: {error_msg}")
                        failed_comparisons.append({"resume_id": resume_id, "error": str(e)})
                
                if not created_comparisons:
                    raise ValueError(f"No comparisons could be created for job {request.job_id}. Errors: {failed_comparisons}")
                
                print(f"Successfully created {len(created_comparisons)} comparisons")
                
                # Wait a bit for comparisons to be processed (in a real system, you might want to poll)
                import time
                time.sleep(2)
                
                # Get the updated comparisons
                all_comparisons = self.comparison_service.get_comparisons_by_job(request.job_id)
                print(f"Retrieved {len(all_comparisons)} comparisons after creation")
            else:
                raise ValueError(f"No resumes found for job {request.job_id}. Please upload resumes and associate them with this job.")
        
        if not all_comparisons:
            raise ValueError(f"No comparisons found for job {request.job_id}")
        
        # Filter comparisons based on provided resume_ids
        if request.resume_ids:
            comparisons = [c for c in all_comparisons if c.resume_id in request.resume_ids]
            if not comparisons:
                raise ValueError("No comparisons found for the specified resume IDs.")
            print(f"Filtered to {len(comparisons)} comparisons based on provided resume IDs")
        else:
            comparisons = all_comparisons
            print(f"Using all {len(comparisons)} comparisons")
        
        # Calculate rankings with normalized criteria
        ranked_candidates = self._calculate_rankings(comparisons, normalized_criteria)
        print(f"Calculated rankings for {len(ranked_candidates)} candidates")
        
        # Apply filters
        if request.filters:
            original_count = len(ranked_candidates)
            ranked_candidates = self._apply_filters(ranked_candidates, request.filters)
            print(f"Applied filters, reduced from {original_count} to {len(ranked_candidates)} candidates")
        
        ranking = CandidateRanking(
            id=ranking_id,
            job_id=request.job_id,
            criteria=normalized_criteria,
            candidates=ranked_candidates,
            total_candidates=len(ranked_candidates),
            created_at=datetime.now()
        )
        
        # Save ranking
        self._save_ranking(ranking)
        print(f"Saved ranking {ranking.id} with {ranking.total_candidates} candidates")
        
        return ranking

    def _normalize_criteria_weights(self, criteria: RankingCriteria) -> RankingCriteria:
        """Normalize ranking criteria weights to ensure they sum to 1."""
        
        total_weight = (criteria.skills_weight + 
                        criteria.experience_weight + 
                        criteria.education_weight + 
                        criteria.keyword_weight)

        if total_weight == 0:
            # Avoid division by zero; return a default balanced weighting
            return criteria.copy(update={
                'skills_weight': 0.25,
                'experience_weight': 0.25,
                'education_weight': 0.25,
                'keyword_weight': 0.25,
            })

        if abs(total_weight - 1.0) > 1e-9: # Allow for floating point inaccuracies
            factor = 1.0 / total_weight
            return criteria.copy(update={
                'skills_weight': criteria.skills_weight * factor,
                'experience_weight': criteria.experience_weight * factor,
                'education_weight': criteria.education_weight * factor,
                'keyword_weight': criteria.keyword_weight * factor,
            })
        
        return criteria

    def _calculate_rankings(self, comparisons: List[ResumeJobComparison],
                          criteria: RankingCriteria) -> List[RankedCandidate]:
        """Calculate candidate rankings based on criteria"""
        candidates = []
        
        for comparison in comparisons:
            if comparison.status != "completed" or not comparison.ats_score:
                continue
            
            composite_score = self._calculate_composite_score(comparison, criteria)
            
            # Determine if candidate meets minimum requirements
            meets_requirements = self._check_minimum_requirements(comparison, criteria)
            
            candidate = RankedCandidate(
                resume_id=comparison.resume_id,
                comparison_id=comparison.id,
                composite_score=composite_score,
                skills_score=comparison.ats_score.skills_score,
                experience_score=comparison.ats_score.experience_score,
                education_score=comparison.ats_score.education_score,
                keyword_score=comparison.ats_score.keywords_score,
                skill_match_percentage=self._calculate_skill_match_percentage(comparison),
                meets_requirements=meets_requirements,
                resume_filename=comparison.resume_filename,
                candidate_name=getattr(comparison, 'candidate_name', 'Unknown')
            )
            
            candidates.append(candidate)
        
        # Sort by composite score (descending)
        candidates.sort(key=lambda x: x.composite_score, reverse=True)
        
        # Assign ranks
        for i, candidate in enumerate(candidates, 1):
            candidate.rank = i
        
        return candidates
    
    def _calculate_composite_score(self, comparison: ResumeJobComparison,
                                 criteria: RankingCriteria) -> float:
        """Calculate weighted composite score using normalized weights."""
        if not comparison.ats_score:
            return 0.0
            
        # Weights are pre-normalized, so we can just multiply and sum
        composite_score = (
            (comparison.ats_score.skills_score * criteria.skills_weight) +
            (comparison.ats_score.experience_score * criteria.experience_weight) +
            (comparison.ats_score.education_score * criteria.education_weight) +
            (comparison.ats_score.keywords_score * criteria.keyword_weight)
        )
        
        return composite_score
    
    def _calculate_skill_match_percentage(self, comparison: ResumeJobComparison) -> float:
        """Calculate skill match percentage"""
        if not comparison.ats_score or not hasattr(comparison.ats_score, 'matched_skills'):
            return 0.0
        
        # This would depend on your specific skills matching logic
        # For now, we'll use the skills score as a proxy
        return comparison.ats_score.skills_score
    
    def _check_minimum_requirements(self, comparison: ResumeJobComparison,
                                  criteria: RankingCriteria) -> bool:
        """Check if candidate meets minimum requirements"""
        if not comparison.ats_score:
            return False
        
        checks = []
        
        if criteria.min_overall_score is not None:
            checks.append(comparison.ats_score.overall_score >= criteria.min_overall_score)
        
        if criteria.min_skills_score is not None:
            checks.append(comparison.ats_score.skills_score >= criteria.min_skills_score)
        
        if criteria.min_experience_score is not None:
            checks.append(comparison.ats_score.experience_score >= criteria.min_experience_score)
        
        return all(checks) if checks else True
    
    def _apply_filters(self, candidates: List[RankedCandidate],
                      filters: Dict) -> List[RankedCandidate]:
        """Apply additional filters to candidates"""
        filtered_candidates = candidates.copy()
        
        if 'min_score' in filters:
            filtered_candidates = [c for c in filtered_candidates 
                                 if c.composite_score >= filters['min_score']]
        
        if 'max_score' in filters:
            filtered_candidates = [c for c in filtered_candidates 
                                 if c.composite_score <= filters['max_score']]
        
        if 'meets_requirements_only' in filters and filters['meets_requirements_only']:
            filtered_candidates = [c for c in filtered_candidates if c.meets_requirements]
        
        if 'top_n' in filters:
            filtered_candidates = filtered_candidates[:filters['top_n']]
        
        return filtered_candidates
    
    def get_ranking(self, ranking_id: str) -> Optional[CandidateRanking]:
        """Get a specific ranking"""
        file_path = os.path.join(self.data_dir, f"{ranking_id}.json")
        
        if not os.path.exists(file_path):
            return None
        
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            return CandidateRanking(**data)
        except Exception:
            return None
    
    def get_rankings_by_job(self, job_id: str) -> List[CandidateRanking]:
        """Get all rankings for a specific job"""
        rankings = []
        
        for filename in os.listdir(self.data_dir):
            if filename.endswith('.json'):
                ranking = self.get_ranking(filename[:-5])  # Remove .json extension
                if ranking and ranking.job_id == job_id:
                    rankings.append(ranking)
        
        return sorted(rankings, key=lambda x: x.created_at, reverse=True)
    
    def compare_candidates(self, candidate_ids: List[str],
                          job_id: str) -> Dict:
        """Compare specific candidates side by side"""
        comparisons = []
        
        for candidate_id in candidate_ids:
            comparison = self.comparison_service.get_comparison_by_resume_and_job(
                candidate_id, job_id
            )
            if comparison:
                comparisons.append(comparison)
        
        if not comparisons:
            return {"error": "No comparisons found for specified candidates"}
        
        # Calculate comparison metrics
        scores = [c.ats_score.overall_score for c in comparisons if c.ats_score]
        
        return {
            "candidates": [
                {
                    "resume_id": c.resume_id,
                    "filename": c.resume_filename,
                    "total_score": c.ats_score.overall_score if c.ats_score else 0,
                    "skills_score": c.ats_score.skills_score if c.ats_score else 0,
                    "experience_score": c.ats_score.experience_score if c.ats_score else 0,
                    "education_score": c.ats_score.education_score if c.ats_score else 0,
                    "keyword_score": c.ats_score.keywords_score if c.ats_score else 0,
                    "recommendations": c.ats_score.recommendations if c.ats_score else []
                }
                for c in comparisons
            ],
            "statistics": {
                "highest_score": max(scores) if scores else 0,
                "lowest_score": min(scores) if scores else 0,
                "average_score": statistics.mean(scores) if scores else 0,
                "score_range": max(scores) - min(scores) if scores else 0
            }
        }
    
    def get_shortlist_suggestions(self, job_id: str,
                                count: int = 10) -> List[RankedCandidate]:
        """Get AI-suggested shortlist of top candidates"""
        # Get latest ranking for the job
        rankings = self.get_rankings_by_job(job_id)
        
        if not rankings:
            # Create a default ranking if none exists
            default_criteria = RankingCriteria(
                skills_weight=0.4,
                experience_weight=0.3,
                education_weight=0.15,
                keyword_weight=0.15
            )
            
            request = RankingRequest(
                job_id=job_id,
                criteria=default_criteria
            )
            
            ranking = self.create_ranking(request)
            candidates = ranking.candidates
        else:
            candidates = rankings[0].candidates
        
        # Filter for candidates that meet requirements
        qualified_candidates = [c for c in candidates if c.meets_requirements]
        
        # If not enough qualified candidates, include top scorers
        if len(qualified_candidates) < count:
            additional_needed = count - len(qualified_candidates)
            unqualified_top = [c for c in candidates if not c.meets_requirements][:additional_needed]
            qualified_candidates.extend(unqualified_top)
        
        return qualified_candidates[:count]
    
    def get_ranking_statistics(self, job_id: str) -> Dict[str, Any]:
        """Get ranking statistics for a job."""
        rankings = self.get_rankings_by_job(job_id)
        
        if not rankings:
            # If no rankings exist, derive statistics from raw comparisons
            comparisons = self.comparison_service.get_comparisons_by_job(job_id)
            completed_comparisons = [c for c in comparisons if c.status == "completed" and c.ats_score]
            
            if not completed_comparisons:
                return {
                    "total_rankings": 0,
                    "total_candidates": 0,
                    "average_score": 0,
                    "top_score": 0,
                    "candidates_meeting_requirements": 0
                }
            
            scores = [c.ats_score.overall_score for c in completed_comparisons if c.ats_score is not None]
            return {
                "total_rankings": 0,
                "total_candidates": len(completed_comparisons),
                "average_score": statistics.mean(scores) if scores else 0,
                "top_score": max(scores) if scores else 0,
                "candidates_meeting_requirements": len(completed_comparisons) # Placeholder
            }
        
        latest_ranking = rankings[0]
        return {
            "total_rankings": len(rankings),
            "total_candidates": latest_ranking.total_candidates,
            "average_score": latest_ranking.average_score,
            "top_score": latest_ranking.top_score,
            "candidates_meeting_requirements": latest_ranking.candidates_meeting_requirements
        }

    def get_unranked_candidates_for_job(self, job_id: str) -> List[Dict[str, Any]]:
        """Get all candidates that have been compared to a job (before ranking creation)."""
        comparisons = self.comparison_service.get_comparisons_by_job(job_id)
        
        candidates = []
        for comp in comparisons:
            if comp.status == "completed" and comp.ats_score:
                candidates.append({
                    "resume_id": comp.resume_id,
                    "comparison_id": comp.id,
                    "composite_score": comp.ats_score.overall_score,
                    "skills_score": comp.ats_score.skills_score,
                    "experience_score": comp.ats_score.experience_score,
                    "education_score": comp.ats_score.education_score,
                    "keyword_score": comp.ats_score.keywords_score,
                    "skill_match_percentage": comp.ats_score.skills_score, # Proxy
                    "meets_requirements": True, # Default for display
                    "resume_filename": comp.resume_filename,
                    "candidate_name": getattr(comp, 'candidate_name', 'Unknown'),
                    "rank": 0 # Not ranked
                })
        
        # Sort by composite score
        return sorted(candidates, key=lambda x: x["composite_score"], reverse=True)

    def _save_ranking(self, ranking: CandidateRanking):
        """Save ranking to file"""
        file_path = os.path.join(self.data_dir, f"{ranking.id}.json")
        
        with open(file_path, 'w') as f:
            json.dump(ranking.dict(), f, indent=2, default=str)
    
    def delete_ranking(self, ranking_id: str) -> bool:
        """Delete a ranking"""
        file_path = os.path.join(self.data_dir, f"{ranking_id}.json")
        
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        
        return False