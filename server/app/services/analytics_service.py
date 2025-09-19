from datetime import datetime, timedelta
from typing import Dict, List, Any
import json
import os
from collections import defaultdict
from statistics import mean, median
import calendar

from app.models.comparison import ResumeJobComparison, ATSScore
from app.models.resume import ParsedResume
from app.models.job import JobDescription
from app.models.analytics import ScoreStatistics
from app.config import settings

class AnalyticsService:
    def __init__(self):
        self.data_dir = settings.UPLOAD_DIR
        self.comparisons_file = os.path.join(self.data_dir, "comparisons", "comparisons.json")
        self.resumes_dir = os.path.join(self.data_dir, "parsed_resumes")
        self.jobs_file = os.path.join(self.data_dir, "jobs", "jobs.json")
    
    def _load_comparisons(self) -> List[Dict]:
        """Load all comparisons from storage"""
        if not os.path.exists(self.comparisons_file):
            return []
        
        with open(self.comparisons_file, 'r') as f:
            try:
                data = json.load(f)
                return data.get('comparisons', [])
            except json.JSONDecodeError:
                return []
    
    def _load_resumes(self) -> List[Dict]:
        """Load all parsed resumes from storage"""
        if not os.path.exists(self.resumes_dir):
            return []
        
        resumes = []
        for filename in os.listdir(self.resumes_dir):
            if filename.endswith(".json"):
                file_path = os.path.join(self.resumes_dir, filename)
                with open(file_path, 'r') as f:
                    try:
                        resumes.append(json.load(f))
                    except json.JSONDecodeError:
                        pass
        return resumes
    
    def _load_jobs(self) -> List[Dict]:
        """Load all jobs from storage"""
        if not os.path.exists(self.jobs_file):
            return []
        
        with open(self.jobs_file, 'r') as f:
            try:
                data = json.load(f)
                return data.get('jobs', [])
            except json.JSONDecodeError:
                return []
    
    def get_overview_metrics(self, days: int = 30) -> Dict[str, Any]:
        """Get high-level overview metrics for the dashboard"""
        comparisons = self._load_comparisons()
        resumes = self._load_resumes()
        jobs = self._load_jobs()
        
        cutoff_date = datetime.now() - timedelta(days=days)
        recent_comparisons = [
            c for c in comparisons 
            if datetime.fromisoformat(c['created_at'].replace('Z', '+00:00')) > cutoff_date
        ]
        
        completed_comparisons = [c for c in comparisons if c.get('status') == 'completed']
        scores = [
            c.get('ats_score', {}).get('overall_score') 
            for c in completed_comparisons 
            if c.get('ats_score')
        ]
        scores = [s for s in scores if s is not None]
        avg_score = mean(scores) if scores else 0

        total_candidates = len(set(c['resume_id'] for c in comparisons))
        total_jobs = len([j for j in jobs if j.get('status') == 'active'])
        processing_success_rate = len(completed_comparisons) / max(len(comparisons), 1) * 100
        
        return {
            "total_candidates": total_candidates,
            "total_active_jobs": total_jobs,
            "total_comparisons": len(comparisons),
            "recent_comparisons": len(recent_comparisons),
            "average_ats_score": round(avg_score, 2),
            "processing_success_rate": round(processing_success_rate, 2),
            "top_performing_score": max(scores, default=0)
        }
    
    def get_score_distribution(self) -> Dict[str, Any]:
        """Get ATS score distribution data for charts"""
        comparisons = self._load_comparisons()
        completed_comparisons = [c for c in comparisons if c.get('status') == 'completed']
        
        scores = [
            c.get('ats_score', {}).get('overall_score')
            for c in completed_comparisons
            if c.get('ats_score')
        ]
        scores = [s for s in scores if s is not None]

        ranges = {
            "0-20": 0, "21-40": 0, "41-60": 0, 
            "61-80": 0, "81-100": 0
        }
        
        for score in scores:
            if score <= 20:
                ranges["0-20"] += 1
            elif score <= 40:
                ranges["21-40"] += 1
            elif score <= 60:
                ranges["41-60"] += 1
            elif score <= 80:
                ranges["61-80"] += 1
            else:
                ranges["81-100"] += 1
        
        return {
            "distribution": [
                {"range": k, "count": v, "percentage": round(v/max(len(scores), 1)*100, 1)}
                for k, v in ranges.items()
            ],
            "statistics": ScoreStatistics(
                mean=round(mean(scores), 2) if scores else 0,
                median=round(median(scores), 2) if scores else 0,
                min=min(scores) if scores else 0,
                max=max(scores) if scores else 0,
                total_candidates=len(scores)
            ).dict(),
            "score_trends": {
                "improving": 0,
                "declining": 0,
                "stable": 0
            }
        }
    
    def get_skills_analytics(self) -> Dict[str, Any]:
        """Analyze skills trends across resumes and job requirements"""
        comparisons = self._load_comparisons()
        jobs = self._load_jobs()
        
        job_skills = defaultdict(float)
        for job in jobs:
            if job.get('status') == 'active':
                for skill in job.get('required_skills', []):
                    job_skills[skill] += 1
                for skill in job.get('preferred_skills', []):
                    job_skills[skill] += 0.5
        
        resume_skills = defaultdict(int)
        skill_scores = defaultdict(list)
        
        for comp in comparisons:
            if comp.get('status') == 'completed' and comp.get('ats_score') and comp.get('ats_score').get('skills_analysis'):
                skills_data = comp['ats_score']['skills_analysis']
                for skill_match in skills_data.get('matched_skills', []):
                    skill = skill_match['skill']
                    resume_skills[skill] += 1
                    if comp.get('ats_score').get('overall_score') is not None:
                        skill_scores[skill].append(comp['ats_score']['overall_score'])
        
        demanded_skills = set(job_skills.keys())
        available_skills = set(resume_skills.keys())
        skill_gaps = demanded_skills - available_skills
        
        return {
            "top_demanded_skills": [
                {"skill": skill, "demand": round(count, 1), "jobs_count": int(count)}
                for skill, count in sorted(job_skills.items(), key=lambda x: x[1], reverse=True)[:10]
            ],
            "top_candidate_skills": [
                {"skill": skill, "candidates": count, "avg_score": round(mean(skill_scores[skill]), 2) if skill_scores[skill] else 0}
                for skill, count in sorted(resume_skills.items(), key=lambda x: x[1], reverse=True)[:10]
            ],
            "skill_gaps": [
                {"skill": skill, "gap_severity": job_skills[skill]}
                for skill in list(skill_gaps)[:10]
            ],
            "skills_summary": {
                "total_unique_skills_demanded": len(demanded_skills),
                "total_unique_skills_available": len(available_skills),
                "skill_coverage_rate": round(len(available_skills) / max(len(demanded_skills), 1) * 100, 2),
                "high_demand_low_supply": len(skill_gaps)
            }
        }
    
    def get_hiring_trends(self, months: int = 12) -> Dict[str, Any]:
        """Get hiring trends over time"""
        comparisons = self._load_comparisons()
        jobs = self._load_jobs()
        
        end_date = datetime.now()
        trends = []
        
        for i in range(months):
            month_start = end_date.replace(day=1) - timedelta(days=30*i)
            month_end = (month_start.replace(day=1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            
            month_comparisons = [
                c for c in comparisons
                if datetime.fromisoformat(c['created_at'].replace('Z', '+00:00')) >= month_start and datetime.fromisoformat(c['created_at'].replace('Z', '+00:00')) <= month_end
            ]
            
            month_jobs = [
                j for j in jobs
                if 'created_at' in j and j['created_at'] and datetime.fromisoformat(j['created_at'].replace('Z', '+00:00')) >= month_start and datetime.fromisoformat(j['created_at'].replace('Z', '+00:00')) <= month_end
            ]
            
            month_scores = [
                c.get('ats_score', {}).get('overall_score')
                for c in month_comparisons 
                if c.get('status') == 'completed' and c.get('ats_score')
            ]
            month_scores = [s for s in month_scores if s is not None]
            
            trends.append({
                "month": month_start.strftime("%Y-%m"),
                "month_name": calendar.month_name[month_start.month],
                "year": month_start.year,
                "comparisons": len(month_comparisons),
                "jobs_created": len(month_jobs),
                "avg_score": round(mean(month_scores), 2) if month_scores else 0,
                "high_scoring_candidates": len([s for s in month_scores if s >= 80])
            })
        
        return {
            "monthly_trends": sorted(trends, key=lambda x: x["month"]),
            "growth_metrics": self._calculate_growth_metrics(trends)
        }
    
    def _calculate_growth_metrics(self, trends: List[Dict]) -> Dict[str, float]:
        """Calculate growth metrics from trends data"""
        if len(trends) < 2:
            return {"comparisons_growth": 0, "jobs_growth": 0, "score_improvement": 0}
        
        sorted_trends = sorted(trends, key=lambda x: x["month"])
        latest = sorted_trends[-1]
        previous = sorted_trends[-2]
        
        comparisons_growth = ((latest["comparisons"] - previous["comparisons"]) / max(previous["comparisons"], 1)) * 100
        jobs_growth = ((latest["jobs_created"] - previous["jobs_created"]) / max(previous["jobs_created"], 1)) * 100
        score_improvement = latest["avg_score"] - previous["avg_score"]
        
        return {
            "comparisons_growth": round(comparisons_growth, 2),
            "jobs_growth": round(jobs_growth, 2),
            "score_improvement": round(score_improvement, 2)
        }
    
    def get_job_performance_metrics(self) -> List[Dict]:
        """Analyze performance metrics for each job"""
        comparisons = self._load_comparisons()
        jobs = self._load_jobs()
        
        job_metrics = {}
        
        for job in jobs:
            job_metrics[job['id']] = {
                "job_id": job['id'],
                "job_title": job['title'],
                "company": job['company'],
                "total_applications": 0,
                "completed_reviews": 0,
                "avg_score": 0,
                "high_scoring_candidates": 0,
                "top_score": 0,
                "created_at": job.get('created_at'),
                "status": job.get('status')
            }
        
        for comp in comparisons:
            job_id = comp.get('job_id')
            if job_id in job_metrics:
                job_metrics[job_id]["total_applications"] += 1
                
                if comp.get('status') == 'completed' and comp.get('ats_score') and comp.get('ats_score').get('overall_score') is not None:
                    job_metrics[job_id]["completed_reviews"] += 1
                    score = comp['ats_score']['overall_score']
                    
                    if score >= 80:
                        job_metrics[job_id]["high_scoring_candidates"] += 1
                    
                    if score > job_metrics[job_id]["top_score"]:
                        job_metrics[job_id]["top_score"] = score
        
        for job_id in job_metrics:
            job_comparisons = [
                c for c in comparisons 
                if c.get('job_id') == job_id and c.get('status') == 'completed' and c.get('ats_score')
            ]
            scores = [c.get('ats_score', {}).get('overall_score') for c in job_comparisons]
            scores = [s for s in scores if s is not None]
            job_metrics[job_id]["avg_score"] = round(mean(scores), 2) if scores else 0
        
        return sorted(job_metrics.values(), key=lambda x: x["avg_score"], reverse=True)
    
    def get_recruiter_insights(self) -> Dict[str, Any]:
        """Generate actionable insights for recruiters"""
        comparisons = self._load_comparisons()
        jobs = self._load_jobs()
        
        completed_comparisons = [c for c in comparisons if c.get('status') == 'completed' and c.get('ats_score')]
        scores = [c.get('ats_score', {}).get('overall_score') for c in completed_comparisons]
        scores = [s for s in scores if s is not None]
        
        total_comparisons = len(completed_comparisons)
        high_scoring = len([s for s in scores if s >= 80])
        
        job_scores = defaultdict(list)
        for comp in completed_comparisons:
            if comp.get('ats_score') and comp.get('ats_score').get('overall_score') is not None:
                job_scores[comp['job_id']].append(comp['ats_score']['overall_score'])
        
        challenging_jobs = []
        for job_id, scores_list in job_scores.items():
            job = next((j for j in jobs if j['id'] == job_id), None)
            if job and len(scores_list) >= 3:
                avg_score = mean(scores_list)
                if avg_score < 60:
                    challenging_jobs.append({
                        "job_title": job['title'],
                        "company": job['company'],
                        "avg_score": round(avg_score, 2),
                        "applications": len(scores_list)
                    })
        
        return {
            "summary": {
                "quality_candidate_rate": round((high_scoring / max(total_comparisons, 1)) * 100, 2),
                "challenging_positions": len(challenging_jobs),
                "active_job_count": len([j for j in jobs if j.get('status') == 'active'])
            },
            "recommendations": [
                {
                    "type": "skill_gaps",
                    "title": "Address Skill Gaps",
                    "description": "Consider training programs or partnerships to address high-demand skills with low candidate availability."
                },
                {
                    "type": "job_requirements",
                    "title": "Review Job Requirements",
                    "description": "Jobs with consistently low scores may have unrealistic requirements or poor job descriptions."
                },
                {
                    "type": "sourcing_strategy",
                    "title": "Improve Sourcing",
                    "description": "Focus recruiting efforts on platforms and channels that yield higher-quality candidates."
                }
            ],
            "challenging_positions": sorted(challenging_jobs, key=lambda x: x["avg_score"])[:5],
            "actionable_insights": self._generate_actionable_insights(comparisons, jobs)
        }
    
    def _generate_actionable_insights(self, comparisons: List[Dict], jobs: List[Dict]) -> List[Dict]:
        """Generate specific actionable insights based on data patterns"""
        insights = []
        
        skill_demand = defaultdict(int)
        skill_matches = defaultdict(int)
        
        for job in jobs:
            for skill in job.get('required_skills', []):
                skill_demand[skill] += 1
        
        for comp in comparisons:
            if comp.get('status') == 'completed' and comp.get('ats_score') and comp.get('ats_score').get('skills_analysis'):
                skills_data = comp['ats_score']['skills_analysis']
                for skill_match in skills_data.get('matched_skills', []):
                    skill = skill_match['skill']
                    skill_matches[skill] += 1
        
        problem_skills = []
        for skill, demand in skill_demand.items():
            if demand >= 3:
                match_rate = skill_matches.get(skill, 0) / demand
                if match_rate < 0.3:
                    problem_skills.append({"skill": skill, "demand": demand, "match_rate": round(match_rate * 100, 1)})
        
        if problem_skills:
            insights.append({
                "type": "skill_shortage",
                "priority": "high",
                "title": f"Critical Skill Shortage: {len(problem_skills)} skills",
                "description": f"Skills like {', '.join([s['skill'] for s in problem_skills[:3]])} have high demand but low candidate availability.",
                "action": "Consider alternative skill requirements or invest in candidate development programs."
            })
        
        return insights

analytics_service = AnalyticsService()