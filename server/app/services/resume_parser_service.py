"""
Resume Parser Service
Handles parsing of resume files and extracting structured data
"""
import re
import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import spacy
from spacy.matcher import Matcher
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import logging

from app.models.resume import ParsedResume, Experience, Education, Skill, ContactInfo
from app.services.text_extraction_service import TextExtractionService

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

logger = logging.getLogger(__name__)

class ResumeParserService:
    def __init__(self):
        # Load spaCy model
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except IOError:
            logger.error("spaCy English model not found. Install with: python -m spacy download en_core_web_sm")
            raise
        
        self.text_extractor = TextExtractionService()
        self.matcher = Matcher(self.nlp.vocab)
        self._setup_patterns()
        
        # Common skills database (expandable)
        self.skills_database = {
            'programming': [
                'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'php', 'ruby', 'go', 'rust',
                'swift', 'kotlin', 'scala', 'r', 'matlab', 'sql', 'html', 'css', 'sass', 'less'
            ],
            'frameworks': [
                'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask', 'spring', 'laravel',
                'ruby on rails', '.net', 'asp.net', 'next.js', 'nuxt.js', 'fastapi', 'tensorflow', 'pytorch'
            ],
            'databases': [
                'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'oracle', 'sqlite', 'cassandra',
                'dynamodb', 'neo4j', 'firebase', 'supabase'
            ],
            'tools': [
                'git', 'docker', 'kubernetes', 'jenkins', 'gitlab', 'github', 'bitbucket', 'jira', 'confluence',
                'slack', 'trello', 'asana', 'figma', 'sketch', 'photoshop', 'illustrator'
            ],
            'cloud': [
                'aws', 'azure', 'google cloud', 'gcp', 'heroku', 'digitalocean', 'linode', 'cloudflare',
                's3', 'ec2', 'lambda', 'api gateway', 'cloudformation'
            ]
        }
        
    def _setup_patterns(self):
        """Setup spaCy patterns for entity recognition"""
        # Email pattern
        email_pattern = [{"LIKE_EMAIL": True}]
        self.matcher.add("EMAIL", [email_pattern])
        
        # Phone pattern
        phone_patterns = [
            [{"TEXT": {"REGEX": r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}"}}],
            [{"TEXT": {"REGEX": r"\+?\d{10,15}"}}]
        ]
        self.matcher.add("PHONE", phone_patterns)
        
    def parse_resume(self, file_path: str, filename: str) -> ParsedResume:
        """Main parsing function"""
        try:
            # Extract text from file
            raw_text = self.text_extractor.extract_text(file_path)
            
            # Process with spaCy
            doc = self.nlp(raw_text)
            
            # Extract different sections
            contact_info = self._extract_contact_info(doc, raw_text)
            skills = self._extract_skills(raw_text, doc)
            experience = self._extract_experience(raw_text, doc)
            education = self._extract_education(raw_text, doc)
            
            # Create parsed resume object
            parsed_resume = ParsedResume(
                filename=filename,
                raw_text=raw_text,
                contact_info=contact_info,
                skills=skills,
                experience=experience,
                education=education,
                parsed_at=datetime.now()
            )
            
            logger.info(f"Successfully parsed resume: {filename}")
            return parsed_resume
            
        except Exception as e:
            logger.error(f"Error parsing resume {filename}: {str(e)}")
            raise
    
    def _extract_contact_info(self, doc, raw_text: str) -> ContactInfo:
        """Extract contact information"""
        contact_info = ContactInfo()
        
        # Find matches using spaCy matcher
        matches = self.matcher(doc)
        
        for match_id, start, end in matches:
            label = self.nlp.vocab.strings[match_id]
            span = doc[start:end]
            
            if label == "EMAIL":
                contact_info.email = span.text.lower()
            elif label == "PHONE":
                contact_info.phone = span.text
        
        # Extract name (usually first line or before email)
        lines = raw_text.split('\n')
        for line in lines[:5]:  # Check first 5 lines
            line = line.strip()
            if line and len(line.split()) <= 4 and not any(char.isdigit() for char in line):
                # Likely a name
                if not any(keyword in line.lower() for keyword in ['resume', 'cv', 'curriculum']):
                    contact_info.name = line
                    break
        
        # Extract LinkedIn URL
        linkedin_match = re.search(r'linkedin\.com/in/[\w\-]+', raw_text, re.IGNORECASE)
        if linkedin_match:
            contact_info.linkedin = "https://" + linkedin_match.group()
        
        return contact_info
    
    def _extract_skills(self, raw_text: str, doc) -> List[Skill]:
        """Extract skills from resume"""
        skills = []
        text_lower = raw_text.lower()
        
        # Find all skills from our database
        found_skills = set()
        
        for category, skill_list in self.skills_database.items():
            for skill in skill_list:
                # Use word boundaries to avoid partial matches
                pattern = r'\b' + re.escape(skill.lower()) + r'\b'
                if re.search(pattern, text_lower):
                    found_skills.add((skill, category))
        
        # Convert to Skill objects
        for skill_name, category in found_skills:
            skills.append(Skill(
                name=skill_name.title(),
                category=category,
                years_of_experience=0  # Could be enhanced to extract years
            ))
        
        # Also extract skills from common sections
        skills_section = self._extract_section(raw_text, ['skills', 'technical skills', 'technologies'])
        if skills_section:
            # Extract additional skills from skills section
            additional_skills = self._parse_skills_section(skills_section)
            skills.extend(additional_skills)
        
        return list({skill.name: skill for skill in skills}.values())  # Remove duplicates
    
    def _extract_experience(self, raw_text: str, doc) -> List[Experience]:
        """Extract work experience"""
        experience = []
        
        # Find experience section
        exp_section = self._extract_section(raw_text, [
            'experience', 'work experience', 'professional experience', 'employment', 'career'
        ])
        
        if exp_section:
            # Split by likely job entries (lines with dates or companies)
            job_entries = self._split_experience_entries(exp_section)
            
            for entry in job_entries:
                exp = self._parse_experience_entry(entry)
                if exp:
                    experience.append(exp)
        
        return experience
    
    def _extract_education(self, raw_text: str, doc) -> List[Education]:
        """Extract education information"""
        education = []
        
        # Find education section
        edu_section = self._extract_section(raw_text, [
            'education', 'academic background', 'qualifications', 'degrees'
        ])
        
        if edu_section:
            # Extract degree information
            degree_patterns = [
                r'(bachelor|master|phd|doctorate|associate|diploma|certificate).*?in\s+([^,\n]+)',
                r'(b\.?s\.?|m\.?s\.?|m\.?b\.?a\.?|ph\.?d\.?|b\.?a\.?)\s*[,\s]*([^,\n]+)',
            ]
            
            for pattern in degree_patterns:
                matches = re.finditer(pattern, edu_section.lower())
                for match in matches:
                    degree_type = match.group(1).strip()
                    field = match.group(2).strip() if len(match.groups()) > 1 else ""
                    
                    education.append(Education(
                        degree=degree_type.title(),
                        field_of_study=field.title(),
                        institution="",  # Could be enhanced
                        graduation_year=None  # Could be enhanced
                    ))
        
        return education
    
    def _extract_section(self, text: str, section_keywords: List[str]) -> Optional[str]:
        """Extract a specific section from resume"""
        text_lower = text.lower()
        lines = text.split('\n')
        
        section_start = -1
        for i, line in enumerate(lines):
            line_lower = line.lower().strip()
            if any(keyword in line_lower for keyword in section_keywords):
                section_start = i
                break
        
        if section_start == -1:
            return None
        
        # Find section end (next section or end of document)
        section_end = len(lines)
        common_sections = [
            'experience', 'education', 'skills', 'projects', 'certifications',
            'awards', 'publications', 'references', 'contact', 'summary', 'objective'
        ]
        
        for i in range(section_start + 1, len(lines)):
            line_lower = lines[i].lower().strip()
            if any(section in line_lower for section in common_sections):
                if not any(keyword in line_lower for keyword in section_keywords):
                    section_end = i
                    break
        
        return '\n'.join(lines[section_start:section_end])
    
    def _parse_skills_section(self, skills_text: str) -> List[Skill]:
        """Parse skills from skills section"""
        skills = []
        
        # Remove common section headers
        skills_text = re.sub(r'^(technical\s+)?skills?:?\s*', '', skills_text.lower().strip())
        
        # Split by common delimiters
        skill_items = re.split(r'[,;•\n\t]', skills_text)
        
        for item in skill_items:
            item = item.strip()
            if item and len(item) > 1:
                skills.append(Skill(
                    name=item.title(),
                    category="other"
                ))
        
        return skills
    
    def _split_experience_entries(self, exp_text: str) -> List[str]:
        """Split experience section into individual job entries"""
        # This is a simplified version - could be enhanced
        lines = exp_text.split('\n')
        entries = []
        current_entry = []
        
        for line in lines[1:]:  # Skip header
            line = line.strip()
            if line:
                # Check if this line starts a new entry (has date pattern or company indicators)
                if re.search(r'\d{4}', line) or any(word in line.lower() for word in ['company', 'inc', 'corp', 'ltd']):
                    if current_entry:
                        entries.append('\n'.join(current_entry))
                        current_entry = []
                current_entry.append(line)
        
        if current_entry:
            entries.append('\n'.join(current_entry))
        
        return entries
    
    def _parse_experience_entry(self, entry: str) -> Optional[Experience]:
        """Parse individual experience entry"""
        lines = entry.split('\n')
        if not lines:
            return None
        
        # Extract job title, company, dates (simplified)
        job_title = ""
        company = ""
        start_date = ""
        end_date = ""
        description = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Look for date patterns
            date_match = re.search(r'(\d{1,2}/\d{4}|\d{4})', line)
            if date_match:
                # This line likely contains dates
                continue
            
            # First non-date line is likely job title
            if not job_title:
                job_title = line
            elif not company:
                company = line
            else:
                description.append(line)
        
        if job_title:
            return Experience(
                job_title=job_title,
                company=company,
                start_date=start_date,
                end_date=end_date,
                description='\n'.join(description)
            )
        
        return None