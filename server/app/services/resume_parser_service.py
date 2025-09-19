import re
import logging
from typing import List, Optional, Dict
import spacy
from datetime import datetime

from app.models.resume import (
    ParsedResume, PersonalInfo, Experience, Education, Skills, ParsedData, 
    ResumeFileMetadata, Skill, ProcessingStatus
)
from app.services.text_extraction_service import TextExtractionService

logger = logging.getLogger(__name__)

class ResumeParserService:
    """Service for parsing resume text and extracting structured information"""
    
    def __init__(self):
        self.text_extractor = TextExtractionService()
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.warning("spaCy English model not found. Installing with: python -m spacy download en_core_web_sm")
            self.nlp = None
        
        # Skills database for categorization
        self.skills_database = {
            "programming": [
                "python", "java", "javascript", "c++", "c#", "php", "ruby", "go", "rust",
                "swift", "kotlin", "scala", "r", "matlab", "sql", "nosql", "html", "css"
            ],
            "web_frameworks": [
                "react", "angular", "vue", "node", "express", "django", "flask", 
                "spring", "laravel", "rails", "asp.net", "next.js", "nuxt.js"
            ],
            "databases": [
                "mysql", "postgresql", "mongodb", "redis", "oracle", "sql server",
                "firebase", "cassandra", "elasticsearch", "dynamodb"
            ],
            "cloud": [
                "aws", "azure", "gcp", "docker", "kubernetes", "terraform", 
                "jenkins", "ansible", "openshift", "heroku"
            ],
            "data_science": [
                "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", 
                "keras", "matplotlib", "seaborn", "plotly", "spark", "hadoop"
            ]
        }

    def parse_resume(self, file_path: str, original_filename: str, file_id: str) -> ParsedResume:
        """
        Parse a resume file and extract structured information
        
        Args:
            file_path: Path to the resume file
            original_filename: Original name of the file
            file_id: The file's unique ID
            
        Returns:
            ParsedResume object with extracted information
        """
        try:
            # Extract text from file
            raw_text = self.text_extractor.extract_text(file_path)
            
            # Process with NLP if available
            doc = self.nlp(raw_text) if self.nlp else None
            
            # Extract structured data
            personal_info = self._extract_personal_info(raw_text, doc)
            experience = self._extract_experience(raw_text, doc)
            education = self._extract_education(raw_text, doc)
            skills_data = self._extract_skills(raw_text, doc)
            
            # Create parsed data object
            parsed_data = ParsedData(
                personal_info=personal_info,
                experience=experience,
                education=education,
                skills=skills_data
            )
            
            # Create metadata
            file_info = self.text_extractor.get_file_info(file_path)
            metadata = ResumeFileMetadata(
                file_size=file_info['file_size'],
                file_type=file_info['file_extension'].lstrip('.'),
                pages=file_info.get('page_count') if file_info['file_extension'] == '.pdf' else None
            )
            
            # Create and return parsed resume
            return ParsedResume(
                id=file_id,
                filename=original_filename,
                raw_text=raw_text,
                parsed_data=parsed_data,
                metadata=metadata,
                status=ProcessingStatus.COMPLETED  # Set status to completed when parsing is successful
            )
            
        except Exception as e:
            logger.error("Error parsing resume %s: %s", original_filename.replace('%', '%%'), str(e).replace('%', '%%'))
            raise

    def _extract_personal_info(self, raw_text: str, doc) -> PersonalInfo:
        """Extract personal information from resume text"""
        # Extract email (more robust pattern)
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        email_matches = re.findall(email_pattern, raw_text)
        email = email_matches[0] if email_matches else None
        
        # Extract phone number (various formats)
        phone_pattern = r'(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}'
        phone_matches = re.findall(phone_pattern, raw_text)
        phone = phone_matches[0] if phone_matches else None
        
        # Extract name (first non-email, non-phone line that looks like a name)
        lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        name = None
        for line in lines[:5]:  # Check first 5 lines
            # Skip if it looks like an email or phone
            if '@' in line or re.search(r'[0-9]{3}[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}', line):
                continue
            # If line has 2-4 words and starts with capital letters, likely a name
            words = line.split()
            if 2 <= len(words) <= 4 and all(word[0].isupper() for word in words if word):
                name = line
                break
        
        # Extract LinkedIn/GitHub (simple pattern matching)
        linkedin = None
        github = None
        lines_lower = raw_text.lower()
        linkedin_matches = re.findall(r'linkedin\.com/in/[\w-]+', lines_lower)
        github_matches = re.findall(r'github\.com/[\w-]+', lines_lower)
        
        if linkedin_matches:
            linkedin = f"https://www.{linkedin_matches[0]}"
        if github_matches:
            github = f"https://www.{github_matches[0]}"
        
        return PersonalInfo(
            name=name,
            email=email,
            phone=phone,
            linkedin=linkedin,
            github=github
        )

    def _extract_experience(self, raw_text: str, doc) -> List[Experience]:
        """Extract work experience with improved logic"""
        experience = []
        
        # Find experience section
        exp_section = self._extract_section(raw_text, [
            'experience', 'work experience', 'professional experience', 'employment', 'career', 'work history'
        ])
        
        if exp_section:
            # Split by likely job entries (lines with dates or company indicators)
            job_entries = self._split_experience_entries(exp_section)
            
            for entry in job_entries:
                exp = self._parse_experience_entry(entry)
                if exp:
                    experience.append(exp)
        
        # If no structured experience found, try to extract from entire text
        if not experience:
            # Look for job title patterns in the entire document
            job_patterns = [
                r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+at\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
                r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*\n\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*\n',
            ]
            
            for pattern in job_patterns:
                matches = re.finditer(pattern, raw_text, re.MULTILINE)
                for match in matches:
                    if len(experience) < 5:  # Limit to prevent false positives
                        experience.append(Experience(
                            position=match.group(1),
                            company=match.group(2),
                            description=[f"Worked as {match.group(1)} at {match.group(2)}"]
                        ))
        
        return experience

    def _extract_education(self, raw_text: str, doc) -> List[Education]:
        """Extract education information with improved logic"""
        education = []
        
        # Find education section
        edu_section = self._extract_section(raw_text, [
            'education', 'academic background', 'qualifications', 'degrees', 'academic'
        ])
        
        if edu_section:
            # Extract degree information using enhanced patterns
            degree_patterns = [
                r'(Bachelor|Master|PhD|Doctorate|Associate|Diploma|Certificate)(?:\'?s)?\s*(?:of\s+)?(?:Science|Arts|Business|Engineering)?\s*(?:in\s+)?([A-Za-z\s]+)',
                r'(B\.?S\.?|M\.?S\.?|M\.?B\.?A\.?|Ph\.?D\.?|B\.?A\.?)\s*[,\s]*([^,\n]+)',
                r'([A-Za-z\s]+)\s*(?:Degree|Diploma|Certificate)',
            ]
            
            for pattern in degree_patterns:
                matches = re.finditer(pattern, edu_section, re.IGNORECASE)
                for match in matches:
                    degree_type = match.group(1).strip()
                    field = match.group(2).strip() if len(match.groups()) > 1 else ""
                    
                    # Extract institution (look for capitalized words after degree)
                    institution = ""
                    after_match = edu_section[match.end():match.end()+100]  # Look 100 chars after match
                    institution_match = re.search(r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)', after_match)
                    if institution_match:
                        institution = institution_match.group(1)
                    
                    education.append(Education(
                        degree=degree_type.title(),
                        field_of_study=field.title(),
                        institution=institution,
                        graduation_date=None  # Could be enhanced
                    ))
        
        # If no education found, try to extract from entire text
        if not education:
            # Simple pattern matching for education
            edu_patterns = [
                r'(University of [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
                r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+University)',
                r'(College of [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
            ]
            
            for pattern in edu_patterns:
                matches = re.finditer(pattern, raw_text)
                for match in matches:
                    if len(education) < 3:  # Limit to prevent false positives
                        education.append(Education(
                            institution=match.group(1),
                            degree="",
                            field_of_study=""
                        ))
        
        return education

    def _extract_skills(self, raw_text: str, doc) -> Skills:
        """Extract skills information"""
        # Find skills section
        skills_section = self._extract_section(raw_text, ['skills', 'technical skills', 'competencies'])
        
        skill_list = []
        if skills_section:
            skill_list = self._parse_skills_section(skills_section)
        else:
            # Try to find skills in the entire document
            skill_list = self._extract_skills_from_text(raw_text)
        
        # Categorize skills
        technical_skills = []
        soft_skills = []
        tools = []
        frameworks = []
        languages = []
        
        for skill in skill_list:
            if skill.category == "programming":
                languages.append(skill.name)
            elif skill.category in ["web_frameworks", "data_science"]:
                frameworks.append(skill.name)
            elif skill.category == "databases":
                tools.append(skill.name)
            elif skill.category == "cloud":
                tools.append(skill.name)
            else:
                technical_skills.append(skill.name)
        
        return Skills(
            technical=technical_skills,
            soft=soft_skills,
            tools=tools,
            frameworks=frameworks,
            languages=languages
        )

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
                # Try to categorize the skill
                category = "other"
                item_lower = item.lower()
                
                # Check categories
                for cat, skill_list in self.skills_database.items():
                    if any(skill.lower() in item_lower for skill in skill_list):
                        category = cat
                        break
                
                skills.append(Skill(
                    name=item.title(),
                    category=category
                ))
        
        return skills

    def _extract_skills_from_text(self, text: str) -> List[Skill]:
        """Extract skills by scanning the entire text"""
        skills = []
        
        # Look for skills in the skills database
        text_lower = text.lower()
        
        for category, skill_list in self.skills_database.items():
            for skill in skill_list:
                if skill.lower() in text_lower:
                    # Check if we already have this skill
                    if not any(s.name.lower() == skill.lower() for s in skills):
                        skills.append(Skill(
                            name=skill.title(),
                            category=category
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
                if re.search(r'\d{4}', line) or any(word in line.lower() for word in ['company', 'inc', 'corp', 'ltd', 'llc']):
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
        location = ""
        
        # First line is likely job title and company
        first_line = lines[0].strip()
        if ' at ' in first_line:
            parts = first_line.split(' at ')
            job_title = parts[0].strip()
            company = parts[1].strip()
        elif ',' in first_line:
            parts = first_line.split(',', 1)
            job_title = parts[0].strip()
            company = parts[1].strip()
        else:
            job_title = first_line
        
        # Look for dates in the entry
        date_pattern = r'(\d{1,2}/\d{4}|\d{4})\s*-?\s*(\d{1,2}/\d{4}|\d{4}|present|current)?'
        date_matches = re.finditer(date_pattern, entry, re.IGNORECASE)
        for match in date_matches:
            if not start_date:
                start_date = match.group(1)
            if match.group(2):
                end_date = match.group(2)
        
        # Collect description lines
        for line in lines[1:]:
            line = line.strip()
            if line and not re.match(date_pattern, line) and line.lower() not in ['present', 'current']:
                description.append(line)
        
        if job_title:
            return Experience(
                position=job_title,
                company=company,
                start_date=start_date,
                end_date=end_date,
                location=location,
                description=description,
                is_current='present' in end_date.lower() or 'current' in end_date.lower()
            )
        
        return None