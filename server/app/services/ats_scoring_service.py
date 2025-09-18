"""
ATS Scoring Service - Core algorithm for matching resumes to job descriptions
"""

import re
from typing import Dict, List, Tuple, Any, Optional
from datetime import datetime
import spacy
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import json
from pathlib import Path

from app.models.resume import ParsedResume
from app.models.job import JobDescription
from app.config import settings

class ATSScorer:
    def __init__(self):
        """Initialize the ATS scoring engine with NLP models"""
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            print("Warning: spaCy model not found. Running without advanced NLP features.")
            self.nlp = None
        
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2),
            lowercase=True
        )
    
    def calculate_ats_score(
        self, 
        resume: ParsedResume, 
        job: JobDescription
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive ATS score for resume-job match
        
        Args:
            resume: Parsed resume data
            job: Job description data
            
        Returns:
            Dict containing detailed scoring information
        """
        # Initialize scoring components
        scores = {
            'skills_score': 0.0,
            'experience_score': 0.0,
            'education_score': 0.0,
            'keywords_score': 0.0,
            'overall_score': 0.0,
            'breakdown': {},
            'recommendations': [],
            'matched_skills': [],
            'missing_skills': [],
            'keyword_matches': []
        }
        
        # Calculate individual scoring components
        skills_result = self._calculate_skills_match(resume, job)
        experience_result = self._calculate_experience_match(resume, job)
        education_result = self._calculate_education_match(resume, job)
        keywords_result = self._calculate_keywords_match(resume, job)
        
        # Apply job-specific weights - create weights object from individual weight fields
        class ATSWeights:
            def __init__(self, skills_weight, experience_weight, education_weight, keywords_weight):
                self.skills_weight = skills_weight
                self.experience_weight = experience_weight
                self.education_weight = education_weight
                self.keywords_weight = keywords_weight
        
        weights = ATSWeights(
            skills_weight=job.weight_skills * 100,
            experience_weight=job.weight_experience * 100,
            education_weight=job.weight_education * 100,
            keywords_weight=job.weight_keywords * 100
        )
        scores['skills_score'] = skills_result['score']
        scores['experience_score'] = experience_result['score']
        scores['education_score'] = education_result['score']
        scores['keywords_score'] = keywords_result['score']
        
        # Calculate weighted overall score
        scores['overall_score'] = (
            (skills_result['score'] * weights.skills_weight / 100) +
            (experience_result['score'] * weights.experience_weight / 100) +
            (education_result['score'] * weights.education_weight / 100) +
            (keywords_result['score'] * weights.keywords_weight / 100)
        )
        
        # Add detailed breakdown
        scores['breakdown'] = {
            'skills': {
                'score': skills_result['score'],
                'weight': weights.skills_weight,
                'weighted_score': skills_result['score'] * weights.skills_weight / 100,
                'details': skills_result['details']
            },
            'experience': {
                'score': experience_result['score'],
                'weight': weights.experience_weight,
                'weighted_score': experience_result['score'] * weights.experience_weight / 100,
                'details': experience_result['details']
            },
            'education': {
                'score': education_result['score'],
                'weight': weights.education_weight,
                'weighted_score': education_result['score'] * weights.education_weight / 100,
                'details': education_result['details']
            },
            'keywords': {
                'score': keywords_result['score'],
                'weight': weights.keywords_weight,
                'weighted_score': keywords_result['score'] * weights.keywords_weight / 100,
                'details': keywords_result['details']
            }
        }
        
        # Collect matched and missing elements
        scores['matched_skills'] = skills_result['matched']
        scores['missing_skills'] = skills_result['missing']
        scores['keyword_matches'] = keywords_result['matches']
        
        # Generate recommendations
        scores['recommendations'] = self._generate_recommendations(
            resume, job, scores['breakdown']
        )
        
        return scores
    
    def _calculate_skills_match(
        self, 
        resume: ParsedResume, 
        job: JobDescription
    ) -> Dict[str, Any]:
        """Calculate skills matching score"""
        # Extract all skills from resume (combine all skill categories)
        all_skills = []
        if resume.parsed_data.skills.technical:
            all_skills.extend(resume.parsed_data.skills.technical)
        if resume.parsed_data.skills.soft:
            all_skills.extend(resume.parsed_data.skills.soft)
        if resume.parsed_data.skills.tools:
            all_skills.extend(resume.parsed_data.skills.tools)
        if resume.parsed_data.skills.frameworks:
            all_skills.extend(resume.parsed_data.skills.frameworks)
        if resume.parsed_data.skills.languages:
            all_skills.extend(resume.parsed_data.skills.languages)
        
        resume_skills = set([skill.lower().strip() for skill in all_skills])
        required_skills = set([skill.lower().strip() for skill in job.required_skills])
        preferred_skills = set([skill.lower().strip() for skill in (job.preferred_skills or [])])
        
        # Find exact matches
        required_matches = resume_skills.intersection(required_skills)
        preferred_matches = resume_skills.intersection(preferred_skills)
        
        # Find partial matches using fuzzy matching
        required_partial = self._find_partial_skill_matches(resume_skills, required_skills)
        preferred_partial = self._find_partial_skill_matches(resume_skills, preferred_skills)
        
        # Calculate score (required skills weighted higher)
        total_required = len(required_skills)
        total_preferred = len(preferred_skills)
        
        if total_required == 0 and total_preferred == 0:
            score = 100.0  # No skills specified
        else:
            required_score = (len(required_matches) + len(required_partial) * 0.5) / max(total_required, 1)
            preferred_score = (len(preferred_matches) + len(preferred_partial) * 0.5) / max(total_preferred, 1)
            
            # Weight required skills as 70%, preferred as 30%
            if total_required > 0 and total_preferred > 0:
                score = (required_score * 0.7 + preferred_score * 0.3) * 100
            elif total_required > 0:
                score = required_score * 100
            else:
                score = preferred_score * 100
        
        matched_skills = list(required_matches.union(preferred_matches))
        missing_required = required_skills - required_matches - set(required_partial)
        missing_preferred = preferred_skills - preferred_matches - set(preferred_partial)
        
        return {
            'score': min(score, 100.0),
            'matched': matched_skills,
            'missing': list(missing_required.union(missing_preferred)),
            'details': {
                'required_matches': len(required_matches),
                'required_partial': len(required_partial),
                'preferred_matches': len(preferred_matches),
                'preferred_partial': len(preferred_partial),
                'total_required': total_required,
                'total_preferred': total_preferred
            }
        }
    
    def _find_partial_skill_matches(
        self, 
        resume_skills: set, 
        job_skills: set
    ) -> List[str]:
        """Find partial skill matches using substring matching"""
        partial_matches = []
        
        for job_skill in job_skills:
            for resume_skill in resume_skills:
                # Check for substring matches (both directions)
                if (job_skill in resume_skill or resume_skill in job_skill) and \
                   len(job_skill) > 2 and len(resume_skill) > 2:
                    partial_matches.append(job_skill)
                    break
        
        return partial_matches
    
    def _calculate_experience_match(
        self, 
        resume: ParsedResume, 
        job: JobDescription
    ) -> Dict[str, Any]:
        """Calculate experience matching score"""
        # Extract years of experience from resume
        total_experience = 0
        relevant_experience = 0
        
        for exp in resume.parsed_data.experience:
            # Simple duration calculation based on dates
            duration = self._calculate_duration_from_dates(exp.start_date, exp.end_date, exp.is_current)
            total_experience += duration
            
            # Check if experience is relevant based on job title or description similarity
            if self._is_relevant_experience(exp, job):
                relevant_experience += duration
        
        # Simple mapping of experience levels to years
        experience_level_mapping = {
            'entry': 0,
            'junior': 1,
            'middle': 3,
            'senior': 5,
            'lead': 7,
            'executive': 10
        }
        
        if job.experience_level:
            required_years = experience_level_mapping.get(job.experience_level.value, 0)
        else:
            required_years = 0
        
        if required_years == 0:
            score = 100.0  # No experience required
        else:
            # Score based on relevant experience with bonus for total experience
            base_score = min(relevant_experience / required_years, 1.0) * 80
            bonus_score = min(total_experience / required_years, 0.5) * 20
            score = (base_score + bonus_score) * 100
        
        return {
            'score': min(score, 100.0),
            'details': {
                'total_experience': total_experience,
                'relevant_experience': relevant_experience,
                'required_years': required_years,
                'experience_positions': len(resume.parsed_data.experience)
            }
        }
    
    def _calculate_education_match(
        self, 
        resume: ParsedResume, 
        job: JobDescription
    ) -> Dict[str, Any]:
        """Calculate education matching score"""
        # Use education_requirements field instead of required_education
        education_reqs = job.education_requirements or []
        if not education_reqs:
            return {'score': 100.0, 'details': {'education_required': False}}
        
        education_levels = {
            'high school': 1,
            'associate': 2,
            'bachelor': 3,
            'master': 4,
            'phd': 5,
            'doctorate': 5
        }
        
        required_level = 0
        for req in education_reqs:
            req_lower = req.lower()
            for level, value in education_levels.items():
                if level in req_lower:
                    required_level = max(required_level, value)
                    break
        
        resume_level = 0
        for edu in resume.parsed_data.education:
            for level, value in education_levels.items():
                if level in edu.degree.lower():
                    resume_level = max(resume_level, value)
                    break
        
        if required_level == 0:
            score = 100.0  # No specific education requirement
        elif resume_level >= required_level:
            score = 100.0  # Meets or exceeds requirement
        elif resume_level > 0:
            score = (resume_level / required_level) * 70  # Partial credit
        else:
            score = 20.0  # No formal education listed
        
        return {
            'score': min(score, 100.0),
            'details': {
                'required_education': ', '.join(education_reqs),
                'resume_education_level': resume_level,
                'required_education_level': required_level,
                'education_count': len(resume.parsed_data.education)
            }
        }
    
    def _calculate_keywords_match(
        self, 
        resume: ParsedResume, 
        job: JobDescription
    ) -> Dict[str, Any]:
        """Calculate keyword matching score using TF-IDF similarity"""
        # Prepare texts from resume data
        all_skills = []
        if resume.parsed_data.skills.technical:
            all_skills.extend(resume.parsed_data.skills.technical)
        if resume.parsed_data.skills.soft:
            all_skills.extend(resume.parsed_data.skills.soft)
        if resume.parsed_data.skills.tools:
            all_skills.extend(resume.parsed_data.skills.tools)
        if resume.parsed_data.skills.frameworks:
            all_skills.extend(resume.parsed_data.skills.frameworks)
        
        resume_text = f"{' '.join(all_skills)}"
        for exp in resume.parsed_data.experience:
            exp_desc = ' '.join(exp.description) if exp.description else ''
            resume_text += f" {exp.position} {exp.company} {exp_desc}"
        
        job_text = f"{job.title} {job.description} {' '.join(job.required_skills + (job.preferred_skills or []))}"
        
        try:
            # Calculate TF-IDF similarity
            tfidf_matrix = self.tfidf_vectorizer.fit_transform([job_text, resume_text])
            similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
            
            score = similarity * 100
            
            # Find specific keyword matches
            job_words = set(re.findall(r'\b\w+\b', job_text.lower()))
            resume_words = set(re.findall(r'\b\w+\b', resume_text.lower()))
            common_words = job_words.intersection(resume_words)
            
            # Filter out common stop words
            stop_words = {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'}
            meaningful_matches = [word for word in common_words if word not in stop_words and len(word) > 2]
            
            return {
                'score': min(score, 100.0),
                'matches': meaningful_matches[:20],  # Top 20 matches
                'details': {
                    'similarity_score': similarity,
                    'total_keyword_matches': len(meaningful_matches),
                    'job_word_count': len(job_words),
                    'resume_word_count': len(resume_words)
                }
            }
            
        except Exception as e:
            # Fallback to simple keyword matching
            print(f"TF-IDF calculation failed: {e}")
            return {
                'score': 50.0,
                'matches': [],
                'details': {'error': 'TF-IDF calculation failed, used fallback'}
            }
    
    def _calculate_duration_from_dates(self, start_date: Optional[str], end_date: Optional[str], is_current: bool) -> float:
        """Calculate duration in years from start and end dates"""
        if not start_date:
            return 1.0  # Default to 1 year if no start date
        
        from datetime import datetime
        import re
        
        try:
            # Try to parse various date formats
            date_patterns = [
                r'(\d{4})-(\d{2})-(\d{2})',  # YYYY-MM-DD
                r'(\d{2})/(\d{2})/(\d{4})',  # MM/DD/YYYY
                r'(\d{4})/(\d{2})',  # YYYY/MM
                r'(\d{4})',  # YYYY only
            ]
            
            start_year = None
            for pattern in date_patterns:
                match = re.search(pattern, start_date)
                if match:
                    if len(match.groups()) >= 3:
                        start_year = int(match.group(1) if len(match.group(1)) == 4 else match.group(3))
                    elif len(match.groups()) >= 2:
                        start_year = int(match.group(1))
                    else:
                        start_year = int(match.group(1))
                    break
            
            if not start_year:
                return 1.0
            
            if is_current:
                end_year = datetime.now().year
            elif end_date:
                end_year = None
                for pattern in date_patterns:
                    match = re.search(pattern, end_date)
                    if match:
                        if len(match.groups()) >= 3:
                            end_year = int(match.group(1) if len(match.group(1)) == 4 else match.group(3))
                        elif len(match.groups()) >= 2:
                            end_year = int(match.group(1))
                        else:
                            end_year = int(match.group(1))
                        break
                if not end_year:
                    end_year = start_year + 1
            else:
                end_year = start_year + 1
            
            return max(end_year - start_year, 0.5)  # Minimum 6 months
            
        except Exception:
            return 1.0  # Default to 1 year on any parsing error
    
    def _extract_duration_from_text(self, duration_text: str) -> float:
        """Extract years of experience from duration text"""
        if not duration_text:
            return 1.0  # Default to 1 year if no duration specified
        
        duration_text = duration_text.lower()
        years = 0.0
        
        # Look for year patterns
        year_match = re.search(r'(\d+)\s*(?:year|yr)', duration_text)
        if year_match:
            years += float(year_match.group(1))
        
        # Look for month patterns
        month_match = re.search(r'(\d+)\s*(?:month|mo)', duration_text)
        if month_match:
            years += float(month_match.group(1)) / 12
        
        return max(years, 0.5)  # Minimum 6 months
    
    def _is_relevant_experience(self, experience, job: JobDescription) -> bool:
        """Check if work experience is relevant to the job"""
        job_title_words = set(job.title.lower().split())
        exp_title_words = set(experience.position.lower().split())
        
        # Get experience description as a single string
        exp_description = ' '.join(experience.description) if experience.description else ''
        
        # Simple relevance check based on title similarity
        common_words = job_title_words.intersection(exp_title_words)
        return len(common_words) > 0 or any(
            skill.lower() in exp_description.lower() 
            for skill in job.required_skills + (job.preferred_skills or [])
        )
    
    def _generate_recommendations(
        self, 
        resume: ParsedResume, 
        job: JobDescription, 
        breakdown: Dict
    ) -> List[str]:
        """Generate improvement recommendations based on scoring"""
        recommendations = []
        
        # Skills recommendations
        skills_score = breakdown['skills']['score']
        if skills_score < 70:
            missing_skills = breakdown['skills']['details'].get('missing', [])
            if missing_skills:
                recommendations.append(
                    f"Consider adding these skills: {', '.join(missing_skills[:5])}"
                )
        
        # Experience recommendations
        experience_score = breakdown['experience']['score']
        if experience_score < 60:
            recommendations.append(
                "Highlight more relevant work experience or include additional details about your accomplishments"
            )
        
        # Keywords recommendations
        keywords_score = breakdown['keywords']['score']
        if keywords_score < 50:
            recommendations.append(
                "Include more job-specific keywords from the job description in your resume"
            )
        
        # Education recommendations
        education_score = breakdown['education']['score']
        if education_score < 80:
            recommendations.append(
                "Consider adding or highlighting relevant education, certifications, or training"
            )
        
        return recommendations


# Service function for easy import
def calculate_ats_score(resume: ParsedResume, job: JobDescription) -> Dict[str, Any]:
    """Convenience function to calculate ATS score"""
    scorer = ATSScorer()
    return scorer.calculate_ats_score(resume, job)