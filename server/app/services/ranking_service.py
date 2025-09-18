import json
import os
from typing import List, Dict, Optional, Tuple
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
    def __init__(self):
        self.data_dir = "data/rankings"
        os.makedirs(self.data_dir, exist_ok=True)
        self.comparison_service: ComparisonService = ComparisonService()
    
    def create_ranking(self, request: RankingRequest) -> CandidateRanking:
        """Create a new candidate ranking"""
        ranking_id = f"ranking_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Get comparisons for the job
        comparisons = self.comparison_service.get_comparisons_by_job(request.job_id)
        
        if not comparisons:
            raise ValueError(f"No comparisons found for job {request.job_id}")
        
        # Calculate rankings
        ranked_candidates = self._calculate_rankings(comparisons, request.criteria)
        
        # Apply filters
        if request.filters:
            ranked_candidates = self._apply_filters(ranked_candidates, request.filters)
        
        ranking = CandidateRanking(
            id=ranking_id,
            job_id=request.job_id,
            criteria=request.criteria,
            candidates=ranked_candidates,
            total_candidates=len(ranked_candidates),
            created_at=datetime.now()
        )
        
        # Save ranking
        self._save_ranking(ranking)
        
        return ranking
    
    def _calculate_rankings(self, comparisons: List[ResumeJobComparison], 
                          criteria: RankingCriteria) -> List[RankedCandidate]:
        """Calculate candidate rankings based on criteria"""
        candidates = []
        
        for comparison in comparisons:
            if comparison.status != "completed" or not comparison.ats_score:
                continue
            
            # Calculate composite score
            composite_score = self._calculate_composite_score(comparison, criteria)
            
            # Calculate individual metrics (with null safety checks)
            if comparison.ats_score:
                skills_score = comparison.ats_score.skills_score
                experience_score = comparison.ats_score.experience_score
                education_score = comparison.ats_score.education_score
                keyword_score = comparison.ats_score.keywords_score
            else:
                skills_score = experience_score = education_score = keyword_score = 0.0
            
            # Calculate skill match percentage
            skill_match_percentage = self._calculate_skill_match_percentage(comparison)
            
            # Determine if candidate meets minimum requirements
            meets_requirements = self._check_minimum_requirements(comparison, criteria)
            
            candidate = RankedCandidate(
                resume_id=comparison.resume_id,
                comparison_id=comparison.id,
                composite_score=composite_score,
                skills_score=skills_score,
                experience_score=experience_score,
                education_score=education_score,
                keyword_score=keyword_score,
                skill_match_percentage=skill_match_percentage,
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
        """Calculate weighted composite score"""
        # Add null safety check for ats_score
        if not comparison.ats_score:
            return 0.0
            
        scores = [
            WeightedScore(comparison.ats_score.skills_score, criteria.skills_weight, 0),
            WeightedScore(comparison.ats_score.experience_score, criteria.experience_weight, 0),
            WeightedScore(comparison.ats_score.education_score, criteria.education_weight, 0),
            WeightedScore(comparison.ats_score.keywords_score, criteria.keyword_weight, 0)
        ]
        
        total_weighted_score = 0
        total_weight = 0
        
        for score in scores:
            score.weighted_value = score.score * score.weight
            total_weighted_score += score.weighted_value
            total_weight += score.weight
        
        return total_weighted_score / total_weight if total_weight > 0 else 0
    
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