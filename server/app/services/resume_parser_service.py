import re
import logging
from typing import List, Optional, Dict, Tuple
import spacy
from datetime import datetime
from dateutil import parser as date_parser
import sys
import subprocess
import importlib

from app.models.resume import (
    ParsedResume, PersonalInfo, Experience, Education, Skills, ParsedData, 
    ResumeFileMetadata, Skill, ProcessingStatus
)
from app.services.text_extraction_service import TextExtractionService

logger = logging.getLogger(__name__)

def ensure_spacy_model():
    """Ensure spaCy English model is available, installing if necessary"""
    try:
        import spacy
        try:
            spacy.load("en_core_web_sm")
            return spacy.load("en_core_web_sm")
        except OSError:
            logger.info("spaCy English model not found, attempting to install...")
            try:
                # Use spacy download command as the primary method for better reliability
                subprocess.run([
                    sys.executable, "-m", "spacy", "download", "en_core_web_sm"
                ], check=True, capture_output=True, text=True, timeout=300)
                
                # Reload spacy and try to load the model
                _ = importlib.reload(spacy)
                return spacy.load("en_core_web_sm")
            except Exception as e:
                # Fallback to direct pip installation
                try:
                    subprocess.run([
                        sys.executable, "-m", "pip", "install", 
                        "https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl"
                    ], check=True, capture_output=True, text=True, timeout=300)
                    
                    # Reload spacy and try to load the model
                    _ = importlib.reload(spacy)
                    return spacy.load("en_core_web_sm")
                except Exception as e2:
                    logger.warning(f"Failed to install/load spaCy model: {e2}")
                    return None
    except Exception as e:
        logger.error(f"Error with spaCy: {e}")
        return None

class ResumeParserService:
    """Service for parsing resume text and extracting structured information"""
    
    def __init__(self):
        self.text_extractor = TextExtractionService()
        self.nlp = ensure_spacy_model()
        
        if self.nlp is not None:
            logger.info("spaCy English model loaded successfully")
        else:
            logger.warning("spaCy English model not available. Running with limited NLP features.")
            logger.info("To install the model, run: python -m spacy download en_core_web_sm")
        
        # Enhanced skills database for categorization with more comprehensive lists
        self.skills_database = {
            "programming": [
                "python", "java", "javascript", "c++", "c#", "php", "ruby", "go", "rust",
                "swift", "kotlin", "scala", "r", "matlab", "sql", "nosql", "html", "css",
                "typescript", "dart", "perl", "lua", "haskell", "elixir", "clojure", "erlang",
                "f#", "objective-c", "assembly", "bash", "shell", "powershell"
            ],
            "web_frameworks": [
                "react", "angular", "vue", "node", "express", "django", 
                "spring", "laravel", "rails", "asp.net", "next.js", "nuxt.js", "svelte",
                "ember", "backbone", "meteor", "koa", "fastapi", "gin", "nestjs", "remix"
            ],
            "databases": [
                "mysql", "postgresql", "mongodb", "redis", "oracle", "sql server",
                "firebase", "cassandra", "elasticsearch", "dynamodb", "neo4j", "couchdb",
                "sqlite", "mariadb", "amazon redshift", "snowflake", "bigquery", "hive"
            ],
            "cloud": [
                "aws", "azure", "gcp", "docker", "kubernetes", "terraform", 
                "jenkins", "ansible", "openshift", "heroku", "digitalocean", "linode",
                "cloudflare", "vercel", "netlify", "openshift", "rancher", "mesos",
                "lambda", "ec2", "s3", "eks", "ecs", "app engine", "cloud run"
            ],
            "data_science": [
                "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", 
                "keras", "matplotlib", "seaborn", "plotly", "spark", "hadoop",
                "tableau", "power bi", "qlik", "looker", "airflow", "kafka",
                "flink", "storm", "nltk", "spacy", "opencv", "xgboost", "lightgbm"
            ],
            "devops": [
                "git", "github", "gitlab", "bitbucket", "jenkins", "circleci", "travis",
                "github actions", "gitlab ci", "ansible", "puppet", "chef", "saltstack",
                "prometheus", "grafana", "datadog", "new relic", "splunk", "elk stack"
            ],
            "testing": [
                "jest", "mocha", "chai", "pytest", "unittest", "selenium", "cypress",
                "playwright", "junit", "testng", "postman", "soapui", "karma", "qunit"
            ],
            "mobile": [
                "react native", "flutter", "xamarin", "ionic", "cordova", "android",
                "ios", "swiftui", "jetpack compose", "kotlin multiplatform"
            ]
        }

        # Common job titles for better experience extraction
        self.common_job_titles = [
            "software engineer", "software developer", "web developer", "frontend developer",
            "backend developer", "full stack developer", "data scientist", "data analyst",
            "machine learning engineer", "devops engineer", "system administrator",
            "network administrator", "product manager", "project manager", "ui designer",
            "ux designer", "graphic designer", "marketing manager", "sales representative",
            "business analyst", "financial analyst", "accountant", "hr manager",
            "operations manager", "ceo", "cto", "cfo", "coo", "intern", "associate",
            "consultant", "analyst", "specialist", "lead", "senior", "junior", "director",
            "architect", "coordinator", "administrator", "programmer", "scientist", "expert"
        ]

        # Common universities and institutions
        self.common_institutions = [
            "harvard", "stanford", "mit", "caltech", "berkeley", "oxford", "cambridge",
            "yale", "princeton", "columbia", "cornell", "university of", "state university",
            "community college", "institute of technology", "polytechnic", "college"
        ]

        # Common degree types
        self.degree_types = {
            "bachelor": ["bachelor", "b.s.", "b.a.", "bs", "ba", "bachelor's", "b.sc"],
            "master": ["master", "m.s.", "m.a.", "ms", "ma", "master's", "m.sc"],
            "doctorate": ["phd", "ph.d.", "doctorate", "doctor", "dr."],
            "associate": ["associate", "a.a.", "a.s.", "associate's"],
            "certificate": ["certificate", "certification", "diploma"]
        }

        # Common section headers for various resume formats
        self.experience_section_headers = [
            'experience', 'work experience', 'professional experience', 'employment', 
            'career', 'work history', 'positions', 'roles', 'job history', 'professional background'
        ]
        
        self.education_section_headers = [
            'education', 'academic background', 'qualifications', 'degrees', 
            'academic', 'university', 'college', 'school', 'academic history'
        ]
        
        self.skills_section_headers = [
            'skills', 'technologies', 'tools', 'competencies', 'abilities',
            'technical skills', 'expertise', 'proficiencies'
        ]

    def _extract_section(self, text: str, keywords: List[str]) -> Optional[str]:
        """Extract a section of text based on keywords with enhanced matching"""
        lines = text.split('\n')
        
        # Find the section start
        section_start = -1
        for i, line in enumerate(lines):
            line_lower = line.lower().strip()
            # Enhanced matching for section headers
            if any(keyword in line_lower for keyword in keywords):
                # Check if it's a clear section header (not part of content)
                if len(line_lower.split()) <= 5:  # Likely a header if short
                    section_start = i
                    break
                # Also check if it's at the beginning of the line with some formatting
                elif re.match(r'^\s*[A-Z][a-zA-Z\s]*:', line):
                    section_start = i
                    break
        
        if section_start == -1:
            return None
        
        # Find the section end (next section header or end of document)
        section_end = len(lines)
        for i in range(section_start + 1, len(lines)):
            line_lower = lines[i].lower().strip()
            # Check if this is a new section header
            all_section_headers = (
                self.experience_section_headers + 
                self.education_section_headers + 
                self.skills_section_headers +
                ['projects', 'certifications', 'awards', 'publications',
                 'references', 'contact', 'summary', 'objective', 'profile']
            )
            if any(header in line_lower for header in all_section_headers) and len(line_lower.split()) <= 5:
                section_end = i
                break
        
        # Extract the section content
        section_lines = lines[section_start:section_end]
        return '\n'.join(section_lines) if section_lines else None

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
        """Extract personal information from resume text with improved accuracy"""
        # Extract email with more robust pattern
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        email_matches = re.findall(email_pattern, raw_text)
        email = email_matches[0] if email_matches else None
        
        # Extract phone number with multiple format support
        phone_patterns = [
            r'(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}',  # US format
            r'(?:\+?[1-9]\d{0,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}',  # International
        ]
        
        phone = None
        for pattern in phone_patterns:
            phone_matches = re.findall(pattern, raw_text)
            if phone_matches:
                phone = phone_matches[0]
                break
        
        # Extract name with improved logic
        name = self._extract_name(raw_text, doc)
        
        # Extract LinkedIn/GitHub with better patterns
        linkedin = self._extract_linkedin(raw_text)
        github = self._extract_github(raw_text)
        portfolio = self._extract_portfolio(raw_text)
        
        # Extract location
        location = self._extract_location(raw_text)
        
        return PersonalInfo(
            name=name,
            email=email,
            phone=phone,
            linkedin=linkedin,
            github=github,
            portfolio=portfolio,
            location=location
        )

    def _extract_name(self, raw_text: str, doc) -> Optional[str]:
        """Extract candidate name with improved accuracy"""
        lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        
        # Look for name in first few lines
        for i, line in enumerate(lines[:3]):
            # Skip lines that look like contact info
            if (re.search(r'@\w|[\d\(\)\-\s]{10,}|linkedin|github', line.lower()) or 
                len(line.split()) > 4 or len(line) < 2):
                continue
            
            # Check if it looks like a name (2-4 capitalized words)
            words = line.split()
            if (2 <= len(words) <= 4 and 
                all(word[0].isupper() for word in words if word and len(word) > 1) and
                not any(char.isdigit() for char in line)):
                return line
        
        # If no clear name found, try to extract from email
        email_pattern = r'\b([A-Za-z]+)\.[A-Za-z]+@'
        email_match = re.search(email_pattern, raw_text)
        if email_match:
            return email_match.group(1).capitalize()
        
        return None

    def _extract_linkedin(self, raw_text: str) -> Optional[str]:
        """Extract LinkedIn profile URL"""
        patterns = [
            r'(?:https?://)?(?:www\.)?linkedin\.com/in/[\w\-]+',
            r'(?:https?://)?(?:www\.)?linkedin\.com/pub/[\w\-/]+',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, raw_text, re.IGNORECASE)
            if matches:
                url = matches[0]
                if not url.startswith('http'):
                    url = 'https://www.' + url
                return url
        return None

    def _extract_github(self, raw_text: str) -> Optional[str]:
        """Extract GitHub profile URL"""
        patterns = [
            r'(?:https?://)?(?:www\.)?github\.com/[\w\-]+',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, raw_text, re.IGNORECASE)
            if matches:
                url = matches[0]
                if not url.startswith('http'):
                    url = 'https://www.' + url
                return url
        return None

    def _extract_portfolio(self, raw_text: str) -> Optional[str]:
        """Extract portfolio URL"""
        patterns = [
            r'(?:https?://)?(?:www\.)?[a-zA-Z0-9\-]+\.com',
            r'(?:https?://)?(?:www\.)?[a-zA-Z0-9\-]+\.io',
        ]
        
        # Exclude common domains that are unlikely to be personal portfolios
        exclude_domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'linkedin.com', 'github.com']
        
        for pattern in patterns:
            matches = re.findall(pattern, raw_text, re.IGNORECASE)
            for match in matches:
                # Check if it's not an excluded domain
                if not any(exclude in match.lower() for exclude in exclude_domains):
                    url = match
                    if not url.startswith('http'):
                        url = 'https://' + url
                    return url
        return None

    def _extract_location(self, raw_text: str) -> Optional[str]:
        """Extract location information"""
        # Look for location patterns in the first part of the resume
        lines = raw_text.split('\n')[:10]
        location_indicators = ['location', 'based in', 'city', 'state']
        
        for line in lines:
            line_lower = line.lower()
            if any(indicator in line_lower for indicator in location_indicators):
                # Extract location after the indicator
                for indicator in location_indicators:
                    if indicator in line_lower:
                        parts = line.split(indicator, 1)
                        if len(parts) > 1:
                            location = parts[1].strip(':, ')
                            if location and len(location) > 1:
                                return location
        
        # If not found, look for standalone lines that might be locations
        for line in lines:
            line = line.strip()
            # Skip if it looks like contact info or is too short/long
            if (len(line) < 20 and len(line) > 2 and 
                not re.search(r'@\w|[\d\(\)\-\s]{10,}|linkedin|github', line.lower()) and
                not any(title in line.lower() for title in self.common_job_titles)):
                # Check if it has at least one comma or looks like a city,state format
                if ',' in line or re.match(r'^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$', line):
                    return line
        
        return None

    def _extract_experience(self, raw_text: str, doc) -> List[Experience]:
        """Extract work experience with improved logic"""
        experience = []
        
        # Find experience section with more comprehensive keywords
        exp_section_keywords = [
            'experience', 'work experience', 'professional experience', 'employment', 
            'career', 'work history', 'positions', 'roles', 'job history'
        ]
        exp_section = self._extract_section(raw_text, exp_section_keywords)
        
        if exp_section:
            # Split by likely job entries
            job_entries = self._split_experience_entries(exp_section)
            
            for entry in job_entries:
                exp = self._parse_experience_entry(entry)
                if exp:
                    experience.append(exp)
        else:
            # Try to find experience entries in the entire document
            experience = self._extract_experience_from_full_text(raw_text)
        
        # Sort by date if possible
        experience.sort(key=lambda x: self._parse_date_for_sorting(x.start_date), reverse=True)
        
        return experience

    def _extract_experience_from_full_text(self, raw_text: str) -> List[Experience]:
        """Extract experience from the full text when section is not clearly defined"""
        experience = []
        
        # Look for job title patterns
        lines = raw_text.split('\n')
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue
                
            # Check if line contains a job title pattern
            if self._is_job_title_line(line):
                # Extract the job entry (current line + next few lines)
                entry_lines = [line]
                j = i + 1
                while j < len(lines) and len(entry_lines) < 10:  # Limit to 10 lines
                    next_line = lines[j].strip()
                    if self._is_job_title_line(next_line) or self._is_section_header(next_line):
                        break
                    if next_line:
                        entry_lines.append(next_line)
                    j += 1
                
                entry_text = '\n'.join(entry_lines)
                exp = self._parse_experience_entry(entry_text)
                if exp:
                    experience.append(exp)
            
            i += 1
        
        return experience

    def _is_job_title_line(self, line: str) -> bool:
        """Check if a line looks like it contains job title information with enhanced logic"""
        line_lower = line.lower()
        
        # Contains common job title indicators
        job_indicators = [' at ', ' - ', ' – ', ' for ', '|', ':']
        if any(indicator in line for indicator in job_indicators):
            return True
            
        # Contains a common job title
        if any(title in line_lower for title in self.common_job_titles):
            return True
            
        # Contains date pattern
        if re.search(r'\d{4}|\d{1,2}[/-]\d{2,4}', line):
            return True
            
        # Looks like a title case line (potential job title)
        if re.match(r'^[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*', line.strip()):
            # Check if it's not too long (likely not a job title if too long)
            if len(line.split()) <= 6:
                return True
            
        return False

    def _is_section_header(self, line: str) -> bool:
        """Check if a line is a section header"""
        line_lower = line.lower().strip()
        section_headers = [
            'education', 'skills', 'projects', 'certifications', 'awards', 
            'publications', 'references', 'contact', 'summary', 'objective'
        ]
        return any(header in line_lower for header in section_headers)

    def _split_experience_entries(self, exp_text: str) -> List[str]:
        """Split experience section into individual job entries with improved logic"""
        lines = exp_text.split('\n')
        entries = []
        current_entry = []
        
        # Skip the section header
        start_idx = 1 if lines and any(keyword in lines[0].lower() for keyword in 
                                      self.experience_section_headers) else 0
        
        for i in range(start_idx, len(lines)):
            line = lines[i].strip()
            if not line:
                continue
                
            # Check if this line starts a new entry
            if self._is_new_experience_entry(lines, i, current_entry):
                if current_entry:
                    entries.append('\n'.join(current_entry))
                    current_entry = []
            current_entry.append(line)
        
        if current_entry:
            entries.append('\n'.join(current_entry))
        
        return entries

    def _is_new_experience_entry(self, lines: List[str], current_index: int, current_entry: List[str]) -> bool:
        """Determine if the current line starts a new experience entry with enhanced logic"""
        if current_index == 0:
            return True
            
        line = lines[current_index].strip()
        
        # Enhanced checks for new experience entries
        # Check for date patterns that indicate new entry
        if re.search(r'\d{4}|\d{1,2}[/-]\d{2,4}|present|current', line, re.IGNORECASE):
            return True
            
        # Check for company name patterns
        if re.search(r'(inc\.?|corp\.?|ltd\.?|llc\.?|company|group|limited)', line, re.IGNORECASE):
            return True
            
        # Check for job title patterns
        if any(title in line.lower() for title in self.common_job_titles):
            return True
            
        # Check for location patterns (City, State format)
        if re.search(r'[A-Z][a-z]+,\s*[A-Z]{2}', line):
            return True
            
        # Check if previous line was empty and current line looks like a job title
        if (current_index > 0 and not lines[current_index-1].strip() and 
            self._is_job_title_line(line)):
            return True
            
        # Check for common separators that indicate a new entry
        if re.match(r'^[A-Z][a-zA-Z\s]*[:\-–—]', line):
            return True
            
        return False

    def _parse_experience_entry(self, entry: str) -> Optional[Experience]:
        """Parse individual experience entry with enhanced logic for better structuring"""
        lines = [line.strip() for line in entry.split('\n') if line.strip()]
        if not lines:
            return None
        
        # Initialize fields
        job_title = ""
        company = ""
        start_date = ""
        end_date = ""
        location = ""
        description = []
        achievements = []
        technologies = []
        is_current = False
        duration = None
        
        # Parse the first line which usually contains job title and company
        first_line = lines[0]
        job_title, company, start_date, end_date, location = self._parse_first_experience_line(first_line)
        
        # Parse remaining lines for dates, location, and description
        i = 1
        while i < len(lines):
            line = lines[i]
            
            # Check for date information
            dates = self._extract_dates_from_line(line)
            if dates:
                if not start_date:
                    start_date = dates[0]
                if len(dates) > 1:
                    end_date = dates[1]
                    is_current = 'present' in end_date.lower() or 'current' in end_date.lower()
            
            # Check for location information
            if not location:
                loc = self._extract_location_from_line(line)
                if loc:
                    location = loc
            
            # Enhanced description parsing - better grouping of responsibilities
            if (not self._is_date_line(line) and 
                not self._is_location_line(line) and 
                line != first_line):
                
                # Check if this is a bullet point/responsibility
                if line.startswith(('-', '•', '*', '·')) or re.match(r'^\d+[\.\)]', line):
                    # This is a bullet point/responsibility
                    description.append(line)
                elif self._is_achievement_line(line):
                    # This is an achievement
                    achievements.append(line)
                elif len(line) > 20:  # Only add substantial lines
                    # Check if this line contains technical skills/technologies
                    if self._contains_technical_terms(line):
                        # Extract technologies from the line
                        techs = self._extract_technologies_from_line(line)
                        technologies.extend(techs)
                        # Only add to description if it's not purely technical
                        if not self._is_purely_technical_line(line):
                            description.append(line)
                    else:
                        description.append(line)
            
            i += 1
        
        # Enhanced parsing for job title and company when first line parsing fails
        if not job_title or not company:
            job_title, company = self._extract_job_title_and_company(lines)
        
        # Cross-reference dates from all lines to ensure consistency
        all_dates = []
        for line in lines:
            dates = self._extract_dates_from_line(line)
            all_dates.extend(dates)
        
        if not start_date and all_dates:
            start_date = all_dates[0]
        if not end_date and len(all_dates) > 1:
            end_date = all_dates[1]
            is_current = 'present' in end_date.lower() or 'current' in end_date.lower()
        
        # Calculate duration if we have both start and end dates
        if start_date and end_date:
            duration = self._extract_duration_from_dates(start_date, end_date)
        
        # If we have a job title, create the experience entry
        if job_title:
            # Enhanced description processing - remove bullet point markers and clean up
            cleaned_description = []
            for desc_line in description:
                # Remove bullet point markers
                cleaned_line = re.sub(r'^[\-\•\*\·\d\.\)]+\s*', '', desc_line).strip()
                if cleaned_line:
                    cleaned_description.append(cleaned_line)
            
            # Clean up achievements
            cleaned_achievements = []
            for achievement_line in achievements:
                # Remove bullet point markers
                cleaned_line = re.sub(r'^[\-\•\*\·\d\.\)]+\s*', '', achievement_line).strip()
                if cleaned_line:
                    cleaned_achievements.append(cleaned_line)
            
            # Remove duplicates from technologies
            technologies = list(set(technologies))
            
            return Experience(
                position=job_title,
                company=company,
                start_date=start_date,
                end_date=end_date,
                location=location,
                duration=duration,
                description=cleaned_description,
                achievements=cleaned_achievements,
                technologies=technologies,
                is_current=is_current
            )
        
        return None

    def _extract_job_title_and_company(self, lines: List[str]) -> Tuple[str, str]:
        """Enhanced extraction of job title and company from multiple lines with better separation"""
        job_title = ""
        company = ""
        
        # Look for common job title patterns
        job_title_patterns = [
            r'(?:^|\s)(?:software|web|frontend|backend|full\s*stack|senior|junior|lead|principal)?\s*(?:developer|engineer|manager|analyst|consultant|specialist|director|associate)\b',
            r'(?:^|\s)(?:programmer|designer|architect|administrator|coordinator)\b'
        ]
        
        # Look for company name patterns
        company_indicators = [
            r'\b(?:Inc\.?|Corp\.?|Corporation|LLC\.?|Ltd\.?|Limited|Group|Company|Co\.?|GmbH|S\.?A\.?|SAS|SA|AG)\b'
        ]
        
        # Process lines to find job title and company
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Try to find job title
            if not job_title:
                for pattern in job_title_patterns:
                    match = re.search(pattern, line, re.IGNORECASE)
                    if match:
                        job_title = match.group(0).strip()
                        break
            
            # Try to find company
            if not company:
                # Look for company indicators
                for pattern in company_indicators:
                    match = re.search(pattern, line, re.IGNORECASE)
                    if match:
                        company = line.strip()
                        break
                
                # If no indicators found, look for proper nouns that might be companies
                if not company and re.match(r'^[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*$', line):
                    # Check if it's not a job title
                    is_job_title = False
                    for pattern in job_title_patterns:
                        if re.search(pattern, line, re.IGNORECASE):
                            is_job_title = True
                            break
                    
                    if not is_job_title:
                        company = line.strip()
        
        # Enhanced fallback logic
        if not job_title and lines:
            # First line might be the job title
            first_line = lines[0].strip()
            # Check if it looks like a job title
            for pattern in job_title_patterns:
                if re.search(pattern, first_line, re.IGNORECASE):
                    job_title = first_line
                    break
            # If no pattern match, use the whole line as job title if it's not obviously a company
            if not job_title and first_line and not any(indicator in first_line.lower() for indicator in ['inc', 'corp', 'llc', 'ltd', 'company']):
                job_title = first_line
        
        if not company and len(lines) > 1:
            # Second line might be the company
            second_line = lines[1].strip()
            # Check if it looks like a company
            is_job_title = False
            for pattern in job_title_patterns:
                if re.search(pattern, second_line, re.IGNORECASE):
                    is_job_title = True
                    break
            
            if not is_job_title:
                company = second_line
        
        return job_title, company

    def _parse_first_experience_line(self, line: str) -> Tuple[str, str, str, str, str]:
        """Parse the first line of an experience entry with enhanced logic"""
        job_title = ""
        company = ""
        start_date = ""
        end_date = ""
        location = ""
        
        # Enhanced parsing with better pattern matching
        # Look for common "Job Title at Company" patterns
        at_pattern = r'^(.*?)\s+(?:at|@|for)\s+(.*?)(?:\s*-\s*|$)'
        match = re.search(at_pattern, line, re.IGNORECASE)
        if match:
            job_title = match.group(1).strip()
            remaining = match.group(2).strip()
            
            # Extract dates and location from remaining text
            date_matches = self._extract_dates_from_line(remaining)
            if date_matches:
                start_date = date_matches[0]
                if len(date_matches) > 1:
                    end_date = date_matches[1]
            
            # Extract location
            location_match = self._extract_location_from_line(remaining)
            if location_match:
                location = location_match
                # Remove location from remaining to get company
                remaining = remaining.replace(location, '').strip(', ')
            
            # What's left should be the company
            if not company and remaining:
                # Remove dates from remaining to get company
                company_text = remaining
                for date in date_matches:
                    company_text = company_text.replace(date, '').strip(', ')
                company = company_text
        else:
            # Try other common patterns
            separators = [
                r'\s+at\s+', r'\s+for\s+', r'\s*[-–]\s*', r'\s*[|]\s*', r'\s*[,]\s*',
                r'\s+with\s+', r'\s+in\s+', r'\s*[:]\s*'
            ]
            
            # Split the line using separators
            parts = re.split('|'.join(separators), line)
            parts = [part.strip() for part in parts if part.strip()]
            
            if len(parts) >= 2:
                # Better heuristic: first part is job title, second is company
                job_title = parts[0]
                company = parts[1]
                
                # Try to extract dates and location from remaining parts
                for part in parts[2:]:
                    if self._is_date_line(part):
                        if not start_date:
                            start_date = part
                        elif not end_date:
                            end_date = part
                    elif self._is_location_line(part):
                        location = part
        
        return job_title, company, start_date, end_date, location

    def _is_date_line(self, line: str) -> bool:
        """Check if a line looks like it contains date information"""
        return bool(re.search(r'\d{4}|\d{1,2}[/-]\d{2,4}', line))

    def _is_location_line(self, line: str) -> bool:
        """Check if a line looks like it contains location information"""
        return bool(re.search(r'[A-Z][a-z]+,\s*[A-Z]{2}', line))

    def _contains_technical_terms(self, line: str) -> bool:
        """Check if a line contains technical terms or technologies"""
        line_lower = line.lower()
        # Check against our skills database
        for category_skills in self.skills_database.values():
            for skill in category_skills:
                if skill in line_lower:
                    return True
        return False

    def _extract_technologies_from_line(self, line: str) -> List[str]:
        """Extract technologies mentioned in a line"""
        technologies = []
        line_lower = line.lower()
        # Check against our skills database
        for category_skills in self.skills_database.values():
            for skill in category_skills:
                if skill in line_lower and skill not in technologies:
                    technologies.append(skill)
        return technologies

    def _is_purely_technical_line(self, line: str) -> bool:
        """Check if a line is purely about technical skills"""
        line_lower = line.lower()
        # Remove common technical terms
        cleaned_line = line_lower
        for category_skills in self.skills_database.values():
            for skill in category_skills:
                cleaned_line = cleaned_line.replace(skill, '')
        # Remove punctuation and whitespace
        cleaned_line = re.sub(r'[^a-zA-Z]', ' ', cleaned_line)
        cleaned_line = re.sub(r'\s+', ' ', cleaned_line).strip()
        # If very little text remains, it's likely purely technical
        return len(cleaned_line) < 10

    def _extract_dates_from_line(self, line: str) -> List[str]:
        """Extract date information from a line with enhanced patterns"""
        # Enhanced patterns to capture full dates
        date_patterns = [
            r'\b(19|20)\d{2}\b',  # Full years (1900-2099)
            r'\b\d{1,2}[/-]\d{2,4}\b',  # MM/YYYY or DD/MM/YYYY formats
        ]
        
        dates = []
        for pattern in date_patterns:
            matches = re.findall(pattern, line)
            # Handle the case where the pattern has groups
            if matches and isinstance(matches[0], tuple):
                # Extract the full match from groups
                dates.extend([match[0] if isinstance(match, tuple) else match for match in matches])
            else:
                dates.extend(matches)
        
        # Remove duplicates while preserving order
        unique_dates = []
        for date in dates:
            if date not in unique_dates:
                unique_dates.append(date)
        
        return unique_dates

    def _extract_location_from_line(self, line: str) -> Optional[str]:
        """Extract location information from a line"""
        location_pattern = r'[A-Z][a-z]+,\s*[A-Z]{2}'
        match = re.search(location_pattern, line)
        return match.group(0) if match else None

    def _parse_date_for_sorting(self, date_str: str) -> Optional[datetime]:
        """Parse date string for sorting purposes"""
        try:
            return date_parser.parse(date_str)
        except (ValueError, OverflowError):
            return None

    def _extract_duration_from_dates(self, start_date: str, end_date: str) -> Optional[str]:
        """Calculate duration between two dates"""
        try:
            start = date_parser.parse(start_date)
            end = date_parser.parse(end_date) if end_date.lower() not in ['present', 'current'] else datetime.now()
            duration = end - start
            years = duration.days // 365
            months = (duration.days % 365) // 30
            if years > 0:
                return f"{years} years {months} months"
            else:
                return f"{months} months"
        except (ValueError, OverflowError):
            return None

    def _extract_education(self, raw_text: str, doc) -> List[Education]:
        """Extract education information with improved logic"""
        education = []
        
        # Find education section with more comprehensive keywords
        edu_section_keywords = [
            'education', 'academic background', 'qualifications', 'degrees', 
            'academic', 'university', 'college', 'school'
        ]
        edu_section = self._extract_section(raw_text, edu_section_keywords)
        
        if edu_section:
            # Split by likely education entries
            edu_entries = self._split_education_entries(edu_section)
            
            for entry in edu_entries:
                edu = self._parse_education_entry(entry)
                if edu:
                    education.append(edu)
        else:
            # Try to find education entries in the entire document
            education = self._extract_education_from_full_text(raw_text)
        
        # Sort by date if possible (using graduation_date)
        education.sort(key=lambda x: self._parse_date_for_sorting(x.graduation_date), reverse=True)
        
        return education

    def _extract_education_from_full_text(self, raw_text: str) -> List[Education]:
        """Extract education from the full text when section is not clearly defined"""
        education = []
        
        # Look for education patterns
        lines = raw_text.split('\n')
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue
                
            # Check if line contains an education pattern
            if self._is_education_line(line):
                # Extract the education entry (current line + next few lines)
                entry_lines = [line]
                j = i + 1
                while j < len(lines) and len(entry_lines) < 10:  # Limit to 10 lines
                    next_line = lines[j].strip()
                    if self._is_education_line(next_line) or self._is_section_header(next_line):
                        break
                    if next_line:
                        entry_lines.append(next_line)
                    j += 1
                
                entry_text = '\n'.join(entry_lines)
                edu = self._parse_education_entry(entry_text)
                if edu:
                    education.append(edu)
            
            i += 1
        
        return education

    def _split_education_entries(self, edu_text: str) -> List[str]:
        """Split education section into individual entries with enhanced logic"""
        lines = edu_text.split('\n')
        entries = []
        current_entry = []
        
        # Skip the section header
        start_idx = 1 if lines and any(keyword in lines[0].lower() for keyword in 
                                      self.education_section_headers) else 0
        
        for i in range(start_idx, len(lines)):
            line = lines[i].strip()
            if not line:
                continue
                
            # Check if this line starts a new entry
            if self._is_new_education_entry(lines, i, current_entry):
                if current_entry:
                    entries.append('\n'.join(current_entry))
                    current_entry = []
            current_entry.append(line)
        
        if current_entry:
            entries.append('\n'.join(current_entry))
        
        return entries

    def _is_new_education_entry(self, lines: List[str], current_index: int, current_entry: List[str]) -> bool:
        """Determine if the current line starts a new education entry with enhanced logic"""
        if current_index == 0:
            return True
            
        line = lines[current_index].strip()
        
        # Check for institution patterns
        if any(institution in line.lower() for institution in self.common_institutions):
            return True
            
        # Check for degree patterns
        if any(any(degree in line.lower() for degree in degrees) for degrees in self.degree_types.values()):
            return True
            
        # Check for date patterns that indicate new entry
        if re.search(r'\d{4}', line):
            return True
            
        # Check for location patterns (City, State format)
        if re.search(r'[A-Z][a-z]+,\s*[A-Z]{2}', line):
            return True
            
        # Check if previous line was empty and current line looks like an education entry
        if (current_index > 0 and not lines[current_index-1].strip() and 
            self._is_education_line(line)):
            return True
            
        # Check for common separators that indicate a new entry
        if re.match(r'^[A-Z][a-zA-Z\s]*[:\-–—]', line):
            return True
            
        return False

    def _is_education_line(self, line: str) -> bool:
        """Check if a line looks like it contains education information with enhanced logic"""
        line_lower = line.lower()
        
        # Contains common institution indicators
        if any(institution in line_lower for institution in self.common_institutions):
            return True
            
        # Contains degree indicators
        if any(any(degree in line_lower for degree in degrees) for degrees in self.degree_types.values()):
            return True
            
        # Contains date pattern
        if re.search(r'\d{4}', line):
            return True
            
        # Contains institution-type words
        institution_words = ['university', 'college', 'institute', 'school', 'academy']
        if any(word in line_lower for word in institution_words):
            return True
            
        # Looks like a title case line (potential institution)
        if re.match(r'^[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*', line.strip()):
            # Check if it's not too long (likely not an institution if too long)
            if len(line.split()) <= 8:
                return True
            
        return False

    def _parse_education_entry(self, entry: str) -> Optional[Education]:
        """Parse individual education entry with enhanced logic"""
        lines = [line.strip() for line in entry.split('\n') if line.strip()]
        if not lines:
            return None
        
        # Initialize fields
        institution = ""
        degree = ""
        field_of_study = ""
        graduation_date = ""
        gpa = ""
        achievements = []
        duration = None
        
        # Parse the first line which usually contains institution and degree
        first_line = lines[0]
        institution, degree, field_of_study = self._parse_first_education_line(first_line)
        
        # Parse remaining lines for other information
        for line in lines[1:]:
            # Check for graduation date
            if not graduation_date:
                dates = self._extract_graduation_dates(line)
                if dates:
                    graduation_date = dates[0]
            
            # Check for GPA/Percentage
            if not gpa:
                gpa_match = self._extract_gpa_or_percentage(line)
                if gpa_match:
                    gpa = gpa_match
            
            # Check for field of study
            if not field_of_study:
                field = self._extract_field_of_study(line)
                if field:
                    field_of_study = field
            
            # Check for achievements
            if self._is_achievement_line(line):
                achievement = self._extract_achievement(line)
                if achievement:
                    achievements.append(achievement)
            
            # Add to achievements if it's not a date, GPA, or field of study
            if (not self._is_graduation_date_line(line) and 
                not self._is_gpa_line(line) and
                not self._is_field_of_study_line(line) and
                not self._is_achievement_line(line) and
                line != first_line):
                # Enhanced achievements parsing - capture bullet points and honors
                if line.startswith(('-', '•', '*', '·')) or re.match(r'^\d+[\.\)]', line):
                    # This is a bullet point/achievement
                    achievement = self._extract_achievement(line)
                    if achievement:
                        achievements.append(achievement)
                elif len(line) > 20:  # Only add substantial lines
                    achievement = self._extract_achievement(line)
                    if achievement:
                        achievements.append(achievement)
        
        # Enhanced parsing for institution, degree, and field of study when first line parsing fails
        if not institution or not degree:
            institution, degree, field_of_study = self._extract_education_details(lines)
        
        # If we have an institution, create the education entry
        if institution:
            # Enhanced achievements processing - remove bullet point markers and clean up
            cleaned_achievements = []
            for achievement_line in achievements:
                # Remove bullet point markers
                cleaned_line = re.sub(r'^[\-\•\*\·\d\.\)]+\s*', '', achievement_line).strip()
                if cleaned_line:
                    cleaned_achievements.append(cleaned_line)
            
            return Education(
                institution=institution,
                degree=degree,
                field_of_study=field_of_study,
                graduation_date=graduation_date,
                duration=duration,
                gpa=gpa,
                achievements=cleaned_achievements
            )
        
        return None

    def _extract_institution_and_degree(self, lines: List[str]) -> Tuple[str, str]:
        """Enhanced extraction of institution and degree from multiple lines"""
        institution = ""
        degree = ""
        
        # Look for common institution patterns
        institution_patterns = [
            r'\b(?:Inc\.?|Corp\.?|Corporation|LLC\.?|Ltd\.?|Limited|Group|Company|Co\.?|GmbH|S\.?A\.?|SAS|SA|AG)\b',
            r'^[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){0,4}$'  # Proper noun patterns
        ]
        
        # Look for degree patterns
        degree_patterns = [
            r'\b(?:bachelor|b\.s\.|b\.a\.|bs|ba|bachelor\'s|b\.sc)\b',
            r'\b(?:master|m\.s\.|m\.a\.|ms|ma|master\'s|m\.sc)\b',
            r'\b(?:phd|ph\.d\.|doctorate|doctor|dr\.)\b',
            r'\b(?:associate|a\.a\.|a\.s\.|associate\'s)\b',
            r'\b(?:certificate|certification|diploma)\b'
        ]
        
        for line in lines:
            # Try to find institution
            if not institution:
                for pattern in institution_patterns:
                    match = re.search(pattern, line)
                    if match:
                        institution = line.strip()
                        break
            
            # Try to find degree
            if not degree:
                for pattern in degree_patterns:
                    match = re.search(pattern, line, re.IGNORECASE)
                    if match:
                        degree = match.group(0).strip()
                        break
        
        return institution, degree

    def _parse_first_education_line(self, line: str) -> Tuple[str, str, str, str, str]:
        """Parse the first line of an education entry with enhanced logic"""
        institution = ""
        degree = ""
        start_date = ""
        end_date = ""
        location = ""
        
        # Enhanced separators including various formats
        separators = [
            r'\s+at\s+', r'\s+for\s+', r'\s*[-–]\s*', r'\s*[|]\s*', r'\s*[,]\s*',
            r'\s+with\s+', r'\s+in\s+', r'\s*[:]\s*'
        ]
        
        # Split the line using separators
        parts = re.split('|'.join(separators), line)
        parts = [part.strip() for part in parts if part.strip()]
        
        if len(parts) >= 2:
            institution = parts[0]
            degree = parts[1]
            
            # Try to extract dates and location from remaining parts
            for part in parts[2:]:
                if self._is_date_line(part):
                    if not start_date:
                        start_date = part
                    elif not end_date:
                        end_date = part
                elif self._is_location_line(part):
                    location = part
        
        return institution, degree, start_date, end_date, location

    def _extract_skills(self, raw_text: str, doc) -> Skills:
        """Extract skills information with improved categorization"""
        technical_skills = []
        soft_skills = []
        tools = []
        frameworks = []
        languages = []
        
        # Find skills section
        skills_section_keywords = ['skills', 'technologies', 'tools', 'competencies', 'abilities']
        skills_section = self._extract_section(raw_text, skills_section_keywords)
        
        if skills_section:
            # Extract skills from the skills section
            skills_text = skills_section.lower()
            
            # Extract technical skills
            for category, skills_list in self.skills_database.items():
                for skill in skills_list:
                    if skill in skills_text:
                        if category == "programming":
                            languages.append(skill)
                        elif category == "web_frameworks":
                            frameworks.append(skill)
                        elif category in ["databases", "cloud", "data_science", "devops"]:
                            tools.append(skill)
                        else:
                            technical_skills.append(skill)
        
        # If no skills section found, try to extract from entire document
        if not technical_skills and not tools and not frameworks and not languages:
            # Use NLP to identify skills if available
            if doc:
                # Extract noun chunks and entities that might be skills
                for chunk in doc.noun_chunks:
                    skill_text = chunk.text.lower().strip()
                    for category, skills_list in self.skills_database.items():
                        if skill_text in skills_list and skill_text not in technical_skills:
                            if category == "programming":
                                languages.append(skill_text)
                            elif category == "web_frameworks":
                                frameworks.append(skill_text)
                            elif category in ["databases", "cloud", "data_science", "devops"]:
                                tools.append(skill_text)
                            else:
                                technical_skills.append(skill_text)
            
            # Fallback: look for skills in the entire text
            if not technical_skills and not tools and not frameworks and not languages:
                text_lower = raw_text.lower()
                for category, skills_list in self.skills_database.items():
                    for skill in skills_list:
                        if skill in text_lower:
                            if category == "programming":
                                languages.append(skill)
                            elif category == "web_frameworks":
                                frameworks.append(skill)
                            elif category in ["databases", "cloud", "data_science", "devops"]:
                                tools.append(skill)
                            else:
                                technical_skills.append(skill)
        
        # Remove duplicates and sort
        technical_skills = sorted(list(set(technical_skills)))
        soft_skills = sorted(list(set(soft_skills)))
        tools = sorted(list(set(tools)))
        frameworks = sorted(list(set(frameworks)))
        languages = sorted(list(set(languages)))
        
        return Skills(
            technical=technical_skills,
            soft=soft_skills,
            tools=tools,
            frameworks=frameworks,
            languages=languages
        )



    def _is_skill_line(self, line: str) -> bool:
        """Check if a line looks like it contains skill information"""
        return bool(re.search(r'\b(?:programming|web frameworks|databases|cloud|data science|devops|testing|mobile)\b', line.lower()))

    def _split_skills_entries(self, skills_text: str) -> List[str]:
        """Split skills section into individual entries with enhanced logic"""
        lines = skills_text.split('\n')
        entries = []
        current_entry = []
        
        # Skip the section header
        start_idx = 1 if lines and any(keyword in lines[0].lower() for keyword in 
                                      self.skills_section_headers) else 0
        
        for i in range(start_idx, len(lines)):
            line = lines[i].strip()
            if not line:
                continue
                
            # Check if this line starts a new entry
            if self._is_new_skill_entry(lines, i, current_entry):
                if current_entry:
                    entries.append('\n'.join(current_entry))
                    current_entry = []
            current_entry.append(line)
        
        if current_entry:
            entries.append('\n'.join(current_entry))
        
        return entries

    def _is_new_skill_entry(self, lines: List[str], current_index: int, current_entry: List[str]) -> bool:
        """Determine if the current line starts a new skill entry with enhanced logic"""
        if current_index == 0:
            return True
            
        line = lines[current_index].strip()
        
        # Check for common separators that indicate a new entry
        if re.match(r'^[A-Z][a-zA-Z\s]*[:\-–—]', line):
            return True
            
        return False







    def _looks_like_job_title(self, text: str) -> bool:
        """Check if text looks like a job title"""
        text_lower = text.lower()
        
        # Common job title indicators
        job_indicators = [
            'developer', 'engineer', 'manager', 'director', 'analyst', 'consultant',
            'specialist', 'associate', 'lead', 'senior', 'junior', 'intern', 'coordinator',
            'designer', 'architect', 'administrator', 'programmer', 'scientist', 'expert'
        ]
        
        # Check for job title keywords
        if any(indicator in text_lower for indicator in job_indicators):
            return True
            
        # Check for proper case pattern (Title Case Words)
        if re.match(r'^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$', text.strip()):
            return True
            
        return False



    def _parse_company_and_dates(self, text: str) -> Tuple[str, str, str, str]:
        """Extract company, dates, and location from text with enhanced logic"""
        company = ""
        start_date = ""
        end_date = ""
        location = ""
        
        # Look for dates in the text
        dates = self._extract_dates_from_line(text)
        if dates:
            start_date = dates[0]
            if len(dates) > 1:
                end_date = dates[1]
        
        # Remove dates from text to get company name
        text_without_dates = re.sub(r'\d{1,2}/\d{2,4}|\d{4}|present|current', '', text, flags=re.IGNORECASE).strip()
        text_without_dates = re.sub(r'\s+', ' ', text_without_dates)  # Clean up extra spaces
        
        # Enhanced company extraction
        # Look for company indicators
        company_indicators = [
            r'\b(?:Inc\.?|Corp\.?|Corporation|LLC\.?|Ltd\.?|Limited|Group|Company|Co\.?|GmbH|S\.?A\.?|SAS|SA|AG)\b'
        ]
        
        for indicator in company_indicators:
            match = re.search(indicator, text_without_dates, re.IGNORECASE)
            if match:
                # Extract company name around the indicator
                start = max(0, match.start() - 20)
                end = min(len(text_without_dates), match.end() + 20)
                company = text_without_dates[start:end].strip()
                # Clean up the company name
                company = re.sub(r'^[,\s]+|[,\s]+$', '', company)
                break
        
        # If no company found with indicators, use the whole text
        if not company:
            company = text_without_dates.strip()
        
        # Try to extract location from company text
        location_match = re.search(r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})', company)
        if location_match:
            location = location_match.group(1)
            # Remove location from company
            company = company.replace(location, '').strip()
            company = re.sub(r'^[,\s]+|[,\s]+$', '', company)
        
        return company, start_date, end_date, location

    def _extract_dates_from_line(self, line: str) -> List[str]:
        """Extract dates from a line of text with enhanced formats"""
        dates = []
        
        # Enhanced patterns for various date formats
        date_patterns = [
            r'(?:\d{1,2}/\d{2,4})\s*[-–]?\s*(?:\d{1,2}/\d{2,4}|present|current)',  # MM/YYYY - MM/YYYY or MM/YYYY - Present
            r'(?:\d{4})\s*[-–]?\s*(?:\d{4}|present|current)',  # YYYY - YYYY or YYYY - Present
            r'(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}',  # Month YYYY
            r'(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}',  # Month DD, YYYY
            r'\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*,?\s+\d{4}',  # DD Month YYYY
            r'(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',  # MM/DD/YYYY or DD/MM/YYYY
        ]
        
        for pattern in date_patterns:
            matches = re.findall(pattern, line, re.IGNORECASE)
            dates.extend(matches)
        
        # Enhanced parsing for date ranges
        if len(dates) == 1 and ' - ' in dates[0]:
            # Split date range into start and end dates
            date_range = dates[0]
            parts = date_range.split(' - ')
            if len(parts) == 2:
                dates = [parts[0].strip(), parts[1].strip()]
        
        return dates

    def _is_date_line(self, line: str) -> bool:
        """Check if a line contains date information"""
        return bool(re.search(r'\d{1,2}/\d{2,4}|\d{4}|present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec', line, re.IGNORECASE))

    def _extract_location_from_line(self, line: str) -> Optional[str]:
        """Extract location from a line"""
        # Simple pattern for city, state format
        match = re.search(r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})', line)
        if match:
            return match.group(1)
        return None

    def _is_location_line(self, line: str) -> bool:
        """Check if a line contains location information"""
        return bool(re.search(r'[A-Z][a-z]+,\s*[A-Z]{2}|[A-Z][a-z]+\s+[A-Z][a-z]+', line))

    def _parse_date_for_sorting(self, date_str: Optional[str]) -> datetime:
        """Parse date string for sorting purposes with enhanced formats"""
        if not date_str:
            return datetime.min
            
        try:
            # Handle common date formats
            if 'present' in date_str.lower() or 'current' in date_str.lower():
                return datetime.now()
            
            # Enhanced date parsing for various formats
            # Handle month name formats
            month_names = {
                'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
                'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
            }
            
            # Check for month name format
            for month_abbr, month_num in month_names.items():
                if month_abbr in date_str.lower():
                    # Format: "Month YYYY" or "Month DD, YYYY"
                    parts = re.findall(rf'{month_abbr}[a-z]*\s+(\d{{1,2}})?,?\s+(\d{{4}})', date_str, re.IGNORECASE)
                    if parts:
                        day, year = parts[0]
                        if day:
                            return datetime(int(year), month_num, int(day))
                        else:
                            return datetime(int(year), month_num, 1)
            
            # Try to parse with dateutil
            return date_parser.parse(date_str)
        except:
            # If parsing fails, return minimum date
            return datetime.min

    def _extract_education(self, raw_text: str, doc) -> List[Education]:
        """Extract education information with improved logic"""
        education = []
        
        # Find education section with more comprehensive keywords
        edu_section_keywords = [
            'education', 'academic background', 'qualifications', 'degrees', 
            'academic', 'university', 'college', 'school'
        ]
        edu_section = self._extract_section(raw_text, edu_section_keywords)
        
        if edu_section:
            # Split by likely education entries
            edu_entries = self._split_education_entries(edu_section)
            
            for entry in edu_entries:
                edu = self._parse_education_entry(entry)
                if edu:
                    education.append(edu)
        else:
            # Try to find education entries in the entire document
            education = self._extract_education_from_full_text(raw_text)
        
        # Sort by date if possible
        education.sort(key=lambda x: self._parse_date_for_sorting(x.graduation_date or ""), reverse=True)
        
        return education

    def _split_education_entries(self, edu_text: str) -> List[str]:
        """Split education section into individual entries"""
        lines = edu_text.split('\n')
        entries = []
        current_entry = []
        
        # Skip the section header
        start_idx = 1 if lines and any(keyword in lines[0].lower() for keyword in 
                                      ['education', 'academic', 'qualifications']) else 0
        
        for i in range(start_idx, len(lines)):
            line = lines[i].strip()
            if not line:
                continue
                
            # Check if this line starts a new entry
            if self._is_new_education_entry(lines, i, current_entry):
                if current_entry:
                    entries.append('\n'.join(current_entry))
                    current_entry = []
            current_entry.append(line)
        
        if current_entry:
            entries.append('\n'.join(current_entry))
        
        return entries

    def _is_new_education_entry(self, lines: List[str], current_index: int, current_entry: List[str]) -> bool:
        """Determine if the current line starts a new education entry"""
        if current_index == 0:
            return True
            
        line = lines[current_index].strip()
        
        # Check for institution patterns
        if any(institution in line.lower() for institution in self.common_institutions):
            return True
            
        # Check for degree patterns
        if any(any(degree in line.lower() for degree in degrees) for degrees in self.degree_types.values()):
            return True
            
        # Check for date patterns that indicate new entry
        if re.search(r'\d{4}', line):
            return True
            
        # Check if previous line was empty and current line looks like an education entry
        if (current_index > 0 and not lines[current_index-1].strip() and 
            self._is_education_line(line)):
            return True
            
        return False

    def _is_education_line(self, line: str) -> bool:
        """Check if a line looks like it contains education information"""
        line_lower = line.lower()
        
        # Contains common institution indicators
        if any(institution in line_lower for institution in self.common_institutions):
            return True
            
        # Contains degree indicators
        if any(any(degree in line_lower for degree in degrees) for degrees in self.degree_types.values()):
            return True
            
        # Contains date pattern
        if re.search(r'\d{4}', line):
            return True
            
        return False

    def _extract_education_from_full_text(self, raw_text: str) -> List[Education]:
        """Extract education from the full text when section is not clearly defined"""
        education = []
        
        # Look for education patterns
        lines = raw_text.split('\n')
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue
                
            # Check if line contains an education pattern
            if self._is_education_line(line):
                # Extract the education entry (current line + next few lines)
                entry_lines = [line]
                j = i + 1
                while j < len(lines) and len(entry_lines) < 8:  # Limit to 8 lines
                    next_line = lines[j].strip()
                    if self._is_education_line(next_line) or self._is_section_header(next_line):
                        break
                    if next_line:
                        entry_lines.append(next_line)
                    j += 1
                
                entry_text = '\n'.join(entry_lines)
                edu = self._parse_education_entry(entry_text)
                if edu:
                    education.append(edu)
            
            i += 1
        
        return education

    def _parse_education_entry(self, entry: str) -> Optional[Education]:
        """Parse individual education entry with enhanced logic for better structuring"""
        lines = [line.strip() for line in entry.split('\n') if line.strip()]
        if not lines:
            return None
        
        # Initialize fields
        institution = ""
        degree = ""
        field_of_study = ""
        graduation_date = ""
        gpa = ""
        achievements = []
        duration = None
        
        # Parse the first line which usually contains institution and degree
        first_line = lines[0]
        institution, degree, field_of_study = self._parse_first_education_line(first_line)
        
        # Parse remaining lines for other information with better grouping
        i = 1
        while i < len(lines):
            line = lines[i]
            
            # Check for graduation date
            if not graduation_date:
                dates = self._extract_graduation_dates(line)
                if dates:
                    graduation_date = dates[0]
            
            # Check for GPA/Percentage
            if not gpa:
                gpa_match = self._extract_gpa_or_percentage(line)
                if gpa_match:
                    gpa = gpa_match
            
            # Check for field of study
            if not field_of_study:
                field = self._extract_field_of_study(line)
                if field:
                    field_of_study = field
            
            # Check for achievements
            if self._is_achievement_line(line):
                achievement = self._extract_achievement(line)
                if achievement:
                    achievements.append(achievement)
            
            # Enhanced parsing - better categorization of information
            if (not self._is_graduation_date_line(line) and 
                not self._is_gpa_line(line) and
                not self._is_field_of_study_line(line) and
                not self._is_achievement_line(line) and
                line != first_line):
                
                # Check if this is a bullet point/achievement
                if line.startswith(('-', '•', '*', '·')) or re.match(r'^\d+[\.\)]', line):
                    # This is a bullet point/achievement
                    achievement = self._extract_achievement(line)
                    if achievement:
                        achievements.append(achievement)
                elif len(line) > 20:  # Only add substantial lines
                    # Cross-reference with known achievement patterns
                    if self._is_achievement_line(line):
                        achievement = self._extract_achievement(line)
                        if achievement:
                            achievements.append(achievement)
                    # If it looks like field of study, update field of study
                    elif self._is_field_of_study_line(line) and not field_of_study:
                        field = self._extract_field_of_study(line)
                        if field:
                            field_of_study = field
            
            i += 1
        
        # Enhanced parsing for institution, degree, and field of study when first line parsing fails
        if not institution or not degree:
            institution, degree, field_of_study = self._extract_education_details(lines)
        
        # Cross-reference dates from all lines to ensure consistency
        all_dates = []
        for line in lines:
            dates = self._extract_graduation_dates(line)
            all_dates.extend(dates)
        
        if not graduation_date and all_dates:
            graduation_date = all_dates[0]
        
        # If we have an institution, create the education entry
        if institution:
            # Enhanced achievements processing - remove bullet point markers and clean up
            cleaned_achievements = []
            for achievement_line in achievements:
                # Remove bullet point markers
                cleaned_line = re.sub(r'^[\-\•\*\·\d\.\)]+\s*', '', achievement_line).strip()
                if cleaned_line:
                    cleaned_achievements.append(cleaned_line)
            
            # Ensure degree is not empty
            if not degree:
                degree = "Degree not specified"
            
            # Ensure field of study is not empty if we can extract it
            if not field_of_study:
                # Try to extract from any line
                for line in lines:
                    field = self._extract_field_of_study_from_text(line)
                    if field:
                        field_of_study = field
                        break
            
            return Education(
                institution=institution,
                degree=degree,
                field_of_study=field_of_study,
                graduation_date=graduation_date,
                duration=duration,
                gpa=gpa,
                achievements=cleaned_achievements
            )
        
        return None

    def _extract_education_details(self, lines: List[str]) -> Tuple[str, str, str]:
        """Enhanced extraction of education details from multiple lines with better structuring"""
        institution = ""
        degree = ""
        field_of_study = ""
        
        # Look for institution patterns
        institution_patterns = [
            r'\b(?:University|College|Institute|School|Academy)\b',
            r'^[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){1,5}$'  # Proper noun patterns
        ]
        
        # Look for degree patterns
        degree_patterns = [
            r'\b(?:Bachelor|Master|Doctor|Ph\.?D|B\.?A|B\.?S|B\.?Sc|M\.?A|M\.?S|M\.?Sc|Ph\.?D)\b',
            r'\b(?:Degree|Diploma|Certificate)\b'
        ]
        
        # Look for field of study patterns
        field_patterns = [
            r'(?:major|field of study|concentration|specialization|focus area)[:\s]+([^\n,]+)',
            r'(?:Bachelor|Master|Doctor)[^,]*\s+in\s+([^\n,]+)',
            r',\s*([^,]+\s+(?:Studies|Science|Engineering|Business|Arts))',
        ]
        
        # Process lines in order to maintain context
        for line in lines:
            line_lower = line.lower()
            
            # Try to find institution
            if not institution:
                for pattern in institution_patterns:
                    match = re.search(pattern, line, re.IGNORECASE)
                    if match:
                        institution = line.strip()
                        break
            
            # Try to find degree
            if not degree:
                for pattern in degree_patterns:
                    match = re.search(pattern, line, re.IGNORECASE)
                    if match:
                        degree = self._extract_degree_from_text(line)
                        break
            
            # Try to find field of study
            if not field_of_study:
                for pattern in field_patterns:
                    match = re.search(pattern, line, re.IGNORECASE)
                    if match:
                        field_candidate = match.group(1).strip() if match.groups() else line.strip()
                        # Validate that it's not just a degree
                        if not any(deg in field_candidate.lower() for deg in ['bachelor', 'master', 'doctor']):
                            field_of_study = field_candidate
                            break
        
        # Enhanced fallback logic
        if not institution:
            # Look for proper nouns that might be institutions
            for line in lines:
                if re.match(r'^[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*$', line.strip()):
                    # Check if it contains institution keywords
                    if any(keyword in line.lower() for keyword in ['university', 'college', 'institute', 'school']):
                        institution = line.strip()
                        break
        
        if not degree:
            # Look for degree patterns in all lines
            for line in lines:
                degree_candidate = self._extract_degree_from_text(line)
                if degree_candidate and degree_candidate != "Degree not specified":
                    degree = degree_candidate
                    break
        
        if not field_of_study:
            # Look for "in" patterns that might indicate field of study
            for line in lines:
                in_match = re.search(r'\s+in\s+([^,\.\n]+)', line, re.IGNORECASE)
                if in_match:
                    field_candidate = in_match.group(1).strip()
                    # Validate that it's not just a degree
                    if not any(deg in field_candidate.lower() for deg in ['bachelor', 'master', 'doctor']):
                        field_of_study = field_candidate
                        break
        
        return institution, degree, field_of_study

    def _parse_first_education_line(self, line: str) -> Tuple[str, str, str]:
        """Parse the first line of an education entry with enhanced logic"""
        institution = ""
        degree = ""
        field_of_study = ""
        
        # Enhanced separators including various formats
        separators = [
            r'\s+at\s+', r'\s*,\s*', r'\s*[-–]\s*', r'\s*[|]\s*',
            r'\s*[:]\s*', r'\s+in\s+'
        ]
        
        # Try to split by separators
        for separator_pattern in separators:
            # Use regex split to handle various separators
            parts = re.split(separator_pattern, line, 1)
            if len(parts) > 1:
                # Determine which part is institution and which contains degree info
                left_part = parts[0].strip()
                right_part = parts[1].strip()
                
                # Check if left part looks like an institution
                if self._looks_like_institution(left_part):
                    institution = left_part
                    degree_info = right_part
                else:
                    # Check if right part looks like an institution
                    if self._looks_like_institution(right_part):
                        institution = right_part
                        degree_info = left_part
                    else:
                        # Default assignment - assume left is institution
                        institution = left_part
                        degree_info = right_part
                
                # Extract degree and field of study from degree info
                degree = self._extract_degree_from_text(degree_info)
                field_of_study = self._extract_field_of_study_from_text(degree_info)
                break
        else:
            # No separator found, try to identify parts differently
            institution, degree, field_of_study = self._parse_education_without_separator(line)
        
        return institution, degree, field_of_study

    def _looks_like_institution(self, text: str) -> bool:
        """Check if text looks like an institution name"""
        text_lower = text.lower()
        
        # Common institution indicators
        institution_indicators = [
            'university', 'college', 'institute', 'school', 'academy', 'faculty'
        ]
        
        # Check for institution keywords
        if any(indicator in text_lower for indicator in institution_indicators):
            return True
            
        # Check for proper case pattern (Title Case Words)
        if re.match(r'^[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*$', text.strip()):
            return True
            
        return False

    def _parse_education_without_separator(self, line: str) -> Tuple[str, str, str]:
        """Parse an education line without clear separators"""
        institution = ""
        degree = ""
        field_of_study = ""
        
        # Extract dates first
        dates = self._extract_graduation_dates(line)
        
        # Remove dates from line
        line_without_dates = line
        for date in dates:
            line_without_dates = line_without_dates.replace(date, '').strip()
        line_without_dates = re.sub(r'\s+', ' ', line_without_dates)  # Clean up extra spaces
        
        # Split by commas
        parts = [part.strip() for part in line_without_dates.split(',') if part.strip()]
        
        if len(parts) >= 2:
            # First part is likely institution, second contains degree info
            institution = parts[0]
            degree_info = parts[1]
            
            # Extract degree and field of study from degree info
            degree = self._extract_degree_from_text(degree_info)
            field_of_study = self._extract_field_of_study_from_text(degree_info)
            
            # Additional parts might be location or more details
            if len(parts) > 2:
                # Check if any remaining part looks like field of study
                for part in parts[2:]:
                    if self._is_field_of_study_line(part):
                        field_of_study = self._extract_field_of_study(part) or part
                        break
        elif len(parts) == 1:
            # Only one part, try to determine components
            part = parts[0]
            if self._looks_like_institution(part):
                institution = part
            elif self._extract_degree_from_text(part) != "Degree not specified":
                degree = self._extract_degree_from_text(part)
                field_of_study = self._extract_field_of_study_from_text(part)
            else:
                institution = part  # Default to institution
        
        return institution, degree, field_of_study

    def _extract_field_of_study_from_text(self, text: str) -> str:
        """Extract field of study from text with enhanced logic"""
        if not text or not text.strip():
            return ""
        
        # Common field of study patterns
        field_patterns = [
            r'(?:major|field of study|concentration|specialization|focus area)[:\s]+([^\n,]+)',
            r'(?:bachelor|master|doctorate|associate)[^,]*\s+in\s+([^\n,]+)',
            r',\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+and\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)*)$',
            r'\b(?:in|of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
        ]
        
        for pattern in field_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match and match.groups():
                field_candidate = match.group(1).strip()
                # Validate that it's not just a degree
                if not any(deg in field_candidate.lower() for deg in ['bachelor', 'master', 'doctor', 'associate']):
                    return field_candidate
        
        # Fallback: if we have text and it doesn't look like a degree, return it
        text_clean = text.strip()
        if text_clean and not any(deg in text_clean.lower() for deg in ['bachelor', 'master', 'doctor', 'associate', 'degree']):
            # Return the text if it looks like a field of study
            if len(text_clean.split()) <= 5:  # Reasonable length for a field of study
                return text_clean
        
        return ""

    def _extract_gpa_or_percentage(self, line: str) -> Optional[str]:
        """Extract GPA or percentage from a line with enhanced patterns"""
        if not line or not line.strip():
            return None
        
        # GPA patterns with better matching
        gpa_patterns = [
            r'(?:GPA|Grade Point Average)[:\s]*([0-9]\.[0-9]{1,3})',
            r'([0-9]\.[0-9]{1,3})\s*(?:GPA|out of 4\.0|out of 4)',
            r'(?:GPA|Grade Point Average)\s*of\s*([0-9]\.[0-9]{1,3})',
            r'(?:percentage|percent)[:\s]*([0-9]{1,3}(?:\.[0-9]{1,2})?)%',
            r'([0-9]{1,3}(?:\.[0-9]{1,2})?)%\s*(?:percentage|percent)',
            r'([0-9]{1,3}(?:\.[0-9]{1,2})?)/(?:[0-9]{1,3}(?:\.[0-9]{1,2})?)\s*(?:GPA|points)',
        ]
        
        for pattern in gpa_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        # Simple pattern for cases like "3.8 GPA" or "3.8/4.0"
        simple_gpa = re.search(r'\b([0-9]\.[0-9]{1,3})\b', line)
        if simple_gpa and 'gpa' in line.lower():
            return simple_gpa.group(1).strip()
        
        return None

    def _is_gpa_line(self, line: str) -> bool:
        """Check if a line contains GPA or percentage information"""
        return bool(re.search(r'(?:GPA|Grade Point Average|percentage|percent)', line, re.IGNORECASE))

    def _is_achievement_line(self, line: str) -> bool:
        """Check if a line contains academic achievements"""
        achievement_indicators = [
            'dean', 'honor', 'scholarship', 'award', 'prize', 'summa', 'magna', 'cum laude',
            'president', 'research', 'thesis', 'dissertation', 'project', 'publication'
        ]
        line_lower = line.lower()
        return any(indicator in line_lower for indicator in achievement_indicators)

    def _extract_achievement(self, line: str) -> str:
        """Extract and clean achievement text"""
        # Remove bullet point markers
        cleaned_line = re.sub(r'^[\-\•\*\·\d\.\)]+\s*', '', line).strip()
        return cleaned_line

    def _extract_skills(self, raw_text: str, doc) -> Skills:
        """Extract skills information with improved categorization"""
        technical_skills = []
        soft_skills = []
        tools = []
        frameworks = []
        languages = []
        
        # Find skills section
        skills_section_keywords = ['skills', 'technologies', 'tools', 'competencies', 'abilities']
        skills_section = self._extract_section(raw_text, skills_section_keywords)
        
        if skills_section:
            # Extract skills from the skills section
            skills_text = skills_section.lower()
            
            # Extract technical skills
            for category, skills_list in self.skills_database.items():
                for skill in skills_list:
                    if skill in skills_text:
                        if category == "programming":
                            languages.append(skill)
                        elif category == "web_frameworks":
                            frameworks.append(skill)
                        elif category in ["databases", "cloud", "data_science", "devops"]:
                            tools.append(skill)
                        else:
                            technical_skills.append(skill)
        
        # If no skills section found, try to extract from entire document
        if not technical_skills and not tools and not frameworks and not languages:
            # Use NLP to identify skills if available
            if doc:
                # Extract noun chunks and entities that might be skills
                for chunk in doc.noun_chunks:
                    skill_text = chunk.text.lower().strip()
                    for category, skills_list in self.skills_database.items():
                        if skill_text in skills_list and skill_text not in technical_skills:
                            if category == "programming":
                                languages.append(skill_text)
                            elif category == "web_frameworks":
                                frameworks.append(skill_text)
                            elif category in ["databases", "cloud", "data_science", "devops"]:
                                tools.append(skill_text)
                            else:
                                technical_skills.append(skill_text)
            
            # Fallback: look for skills in the entire text
            if not technical_skills and not tools and not frameworks and not languages:
                text_lower = raw_text.lower()
                for category, skills_list in self.skills_database.items():
                    for skill in skills_list:
                        if skill in text_lower:
                            if category == "programming":
                                languages.append(skill)
                            elif category == "web_frameworks":
                                frameworks.append(skill)
                            elif category in ["databases", "cloud", "data_science", "devops"]:
                                tools.append(skill)
                            else:
                                technical_skills.append(skill)
        
        # Remove duplicates and sort
        technical_skills = sorted(list(set(technical_skills)))
        soft_skills = sorted(list(set(soft_skills)))
        tools = sorted(list(set(tools)))
        frameworks = sorted(list(set(frameworks)))
        languages = sorted(list(set(languages)))
        
        return Skills(
            technical=technical_skills,
            soft=soft_skills,
            tools=tools,
            frameworks=frameworks,
            languages=languages
        )

    def _extract_section(self, text: str, keywords: List[str]) -> Optional[str]:
        """Extract a section of text based on keywords"""
        lines = text.split('\n')
        
        # Find the section start
        section_start = -1
        for i, line in enumerate(lines):
            line_lower = line.lower().strip()
            if any(keyword in line_lower for keyword in keywords):
                section_start = i
                break
        
        if section_start == -1:
            return None
        
        # Find the section end (next section header or end of document)
        section_end = len(lines)
        for i in range(section_start + 1, len(lines)):
            line_lower = lines[i].lower().strip()
            # Check if this is a new section header
            section_headers = [
                'experience', 'work', 'employment', 'education', 'academic', 
                'skills', 'projects', 'certifications', 'awards', 'publications',
                'references', 'contact', 'summary', 'objective'
            ]
            if any(header in line_lower for header in section_headers) and len(line_lower.split()) <= 4:
                section_end = i
                break
        
        # Extract the section content
        section_lines = lines[section_start:section_end]
        return '\n'.join(section_lines) if section_lines else None

    def _extract_graduation_dates(self, line: str) -> List[str]:
        """Extract graduation dates from a line with enhanced formats"""
        dates = []
        
        # Enhanced patterns for graduation dates (typically just years or month/year)
        date_patterns = [
            r'\b(19|20)\d{2}\b',  # Simple year format
            r'\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(?:19|20)\d{2}\b',  # Month YYYY
            r'\b\d{1,2}/(?:19|20)\d{2}\b',  # MM/YYYY format
        ]
        
        for pattern in date_patterns:
            matches = re.findall(pattern, line, re.IGNORECASE)
            # Handle the case where the pattern has groups
            if matches and isinstance(matches[0], tuple):
                # Extract the full match from groups
                dates.extend([match[0] if isinstance(match, tuple) else match for match in matches])
            else:
                dates.extend(matches)
        
        # Remove duplicates while preserving order
        unique_dates = []
        for date in dates:
            if date not in unique_dates:
                unique_dates.append(date)
        
        return unique_dates

    def _is_graduation_date_line(self, line: str) -> bool:
        """Check if a line contains graduation date information"""
        return bool(re.search(r'\b(19|20)\d{2}\b', line))

    def _extract_field_of_study(self, line: str) -> Optional[str]:
        """Extract field of study from a line"""
        # Common field of study patterns
        field_patterns = [
            r'(?:major|field of study|concentration):\s*([^\n,]+)',
            r'(?:bachelor|master|doctorate|associate)[^,]*in\s+([^\n,]+)',
        ]
        
        for pattern in field_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return None

    def _is_field_of_study_line(self, line: str) -> bool:
        """Check if a line contains field of study information"""
        return bool(re.search(r'major|field of study|concentration|in\s+\w+', line, re.IGNORECASE))

    def _parse_first_education_line(self, line: str) -> Tuple[str, str, str]:
        """Parse the first line of an education entry with enhanced logic"""
        institution = ""
        degree = ""
        field_of_study = ""
        
        # Enhanced parsing with better pattern matching
        # Look for common "Degree in Field of Study from Institution" patterns
        degree_institution_pattern = r'^(.*?)(?:\s+(?:at|from|@)\s+|,\s*)(.*?)(?:\s*-\s*|$)'
        match = re.search(degree_institution_pattern, line, re.IGNORECASE)
        if match:
            degree_part = match.group(1).strip()
            institution_part = match.group(2).strip()
            
            # Extract degree and field of study from degree part
            degree = self._extract_degree_from_text(degree_part)
            field_of_study = self._extract_field_of_study_from_text(degree_part)
            
            # Extract institution
            institution = institution_part
        else:
            # Try other common patterns with better separators
            separators = [
                r'\s+at\s+', r'\s+from\s+', r'\s*[-–]\s*', r'\s*[|]\s*', r'\s*[,]\s*',
                r'\s+with\s+', r'\s+in\s+', r'\s*[:]\s*'
            ]
            
            # Split the line using separators
            parts = re.split('|'.join(separators), line)
            parts = [part.strip() for part in parts if part.strip()]
            
            if len(parts) >= 2:
                # Better heuristic: determine which part is institution vs degree
                for i, part in enumerate(parts):
                    if self._looks_like_institution(part):
                        institution = part
                        # The previous part is likely the degree
                        if i > 0:
                            degree_info = parts[i-1]
                            degree = self._extract_degree_from_text(degree_info)
                            field_of_study = self._extract_field_of_study_from_text(degree_info)
                        # The next part might be field of study
                        elif i < len(parts) - 1:
                            degree_info = parts[i+1]
                            degree = self._extract_degree_from_text(degree_info)
                            field_of_study = self._extract_field_of_study_from_text(degree_info)
                        break
                
                # If we couldn't identify institution, use first part
                if not institution and parts:
                    institution = parts[0]
                    if len(parts) > 1:
                        degree_info = parts[1]
                        degree = self._extract_degree_from_text(degree_info)
                        field_of_study = self._extract_field_of_study_from_text(degree_info)
            elif len(parts) == 1 and parts:
                # Only one part, try to determine what it is
                part = parts[0]
                if self._looks_like_institution(part):
                    institution = part
                else:
                    degree = self._extract_degree_from_text(part)
                    field_of_study = self._extract_field_of_study_from_text(part)
        
        return institution, degree, field_of_study

    def _extract_degree_from_text(self, text: str) -> str:
        """Extract degree information from text with enhanced logic"""
        if not text or not text.strip():
            return "Degree not specified"
        
        text_lower = text.lower()
        
        # Check for specific degree types
        for degree_type, keywords in self.degree_types.items():
            if any(keyword in text_lower for keyword in keywords):
                # Return the actual text that matches, not just the category
                for keyword in keywords:
                    if keyword in text_lower:
                        # Find the actual text in the original string
                        match = re.search(r'\b' + re.escape(keyword) + r'\b', text, re.IGNORECASE)
                        if match:
                            return match.group(0).capitalize()
                # Fallback to category name
                return degree_type.capitalize()
        
        # Enhanced pattern matching for degrees
        degree_patterns = [
            r'\b(?:Bachelor|B\.?A\.?|B\.?S\.?|B\.?Sc\.?)\b',
            r'\b(?:Master|M\.?A\.?|M\.?S\.?|M\.?Sc\.?)\b',
            r'\b(?:Doctor|Ph\.?D\.?)\b',
            r'\b(?:Associate|A\.?A\.?|A\.?S\.?)\b',
            r'\b(?:Diploma|Certificate)\b'
        ]
        
        for pattern in degree_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(0)
        
        # If no specific degree found, return a more descriptive message
        if len(text.strip()) > 3:
            return text.strip()  # Return the actual text if it's substantial
        else:
            return "Degree not specified"

    def _extract_duration_from_dates(self, start_date: str, end_date: str) -> Optional[str]:
        """Calculate duration between two dates"""
        try:
            start = self._parse_date_for_sorting(start_date)
            end = self._parse_date_for_sorting(end_date)
            
            if start != datetime.min and end != datetime.min:
                duration = end - start
                years = duration.days // 365
                months = (duration.days % 365) // 30
                
                if years > 0 and months > 0:
                    return f"{years} years {months} months"
                elif years > 0:
                    return f"{years} years"
                elif months > 0:
                    return f"{months} months"
                else:
                    return "Less than a month"
        except:
            pass
        return None
