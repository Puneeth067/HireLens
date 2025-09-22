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
                "react", "angular", "vue", "node", "express", "django", "flask", 
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
            "operations manager", "ceo", "cto", "cfo", "coo"
        ]

        # Common universities and institutions
        self.common_institutions = [
            "harvard", "stanford", "mit", "caltech", "berkeley", "oxford", "cambridge",
            "yale", "princeton", "columbia", "cornell", "university of", "state university",
            "community college", "institute of technology", "polytechnic"
        ]

        # Common degree types
        self.degree_types = {
            "bachelor": ["bachelor", "b.s.", "b.a.", "bs", "ba", "bachelor's"],
            "master": ["master", "m.s.", "m.a.", "ms", "ma", "master's", "m.sc"],
            "doctorate": ["phd", "ph.d.", "doctorate", "doctor", "dr."],
            "associate": ["associate", "a.a.", "a.s.", "associate's"],
            "certificate": ["certificate", "certification", "diploma"]
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
        """Check if a line looks like it contains job title information"""
        line_lower = line.lower()
        
        # Contains common job title indicators
        job_indicators = [' at ', ' - ', ' – ', ' for ', '|']
        if any(indicator in line for indicator in job_indicators):
            return True
            
        # Contains a common job title
        if any(title in line_lower for title in self.common_job_titles):
            return True
            
        # Contains date pattern
        if re.search(r'\d{4}|\d{1,2}/\d{2,4}', line):
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
                                      ['experience', 'work', 'professional', 'employment']) else 0
        
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
        """Determine if the current line starts a new experience entry"""
        if current_index == 0:
            return True
            
        line = lines[current_index].strip()
        
        # Check for date patterns that indicate new entry
        if re.search(r'\d{4}|\d{1,2}/\d{2,4}|present|current', line, re.IGNORECASE):
            return True
            
        # Check for company name patterns
        if re.search(r'(inc\.?|corp\.?|ltd\.?|llc\.?|company)', line, re.IGNORECASE):
            return True
            
        # Check if previous line was empty and current line looks like a job title
        if (current_index > 0 and not lines[current_index-1].strip() and 
            self._is_job_title_line(line)):
            return True
            
        return False

    def _parse_experience_entry(self, entry: str) -> Optional[Experience]:
        """Parse individual experience entry with enhanced logic"""
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
        is_current = False
        
        # Parse the first line which usually contains job title and company
        first_line = lines[0]
        job_title, company, start_date, end_date, location = self._parse_first_experience_line(first_line)
        
        # Parse remaining lines for dates, location, and description
        for line in lines[1:]:
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
            
            # Add to description if it's not a date or location
            if (not self._is_date_line(line) and 
                not self._is_location_line(line) and 
                line != first_line):
                description.append(line)
        
        # If we have a job title, create the experience entry
        if job_title:
            return Experience(
                position=job_title,
                company=company,
                start_date=start_date,
                end_date=end_date,
                location=location,
                description=description,
                is_current=is_current
            )
        
        return None

    def _parse_first_experience_line(self, line: str) -> Tuple[str, str, str, str, str]:
        """Parse the first line of an experience entry"""
        job_title = ""
        company = ""
        start_date = ""
        end_date = ""
        location = ""
        
        # Common separators in job entries
        separators = [' at ', ' - ', ' – ', ' for ', ' | ', ', ']
        
        # Try to split by separators
        for separator in separators:
            if separator in line:
                parts = line.split(separator, 1)
                job_title = parts[0].strip()
                remaining = parts[1].strip()
                
                # Try to extract company and dates from remaining text
                company, start_date, end_date, location = self._parse_company_and_dates(remaining)
                break
        else:
            # No separator found, treat entire line as job title
            job_title = line
        
        return job_title, company, start_date, end_date, location

    def _parse_company_and_dates(self, text: str) -> Tuple[str, str, str, str]:
        """Extract company, dates, and location from text"""
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
        
        # Company is what remains after removing dates
        company = text_without_dates
        
        return company, start_date, end_date, location

    def _extract_dates_from_line(self, line: str) -> List[str]:
        """Extract dates from a line of text"""
        dates = []
        
        # Pattern for various date formats
        date_patterns = [
            r'(?:\d{1,2}/\d{2,4})\s*[-–]?\s*(?:\d{1,2}/\d{2,4}|present|current)',  # MM/YYYY - MM/YYYY or MM/YYYY - Present
            r'(?:\d{4})\s*[-–]?\s*(?:\d{4}|present|current)',  # YYYY - YYYY or YYYY - Present
            r'(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}',  # Month YYYY
        ]
        
        for pattern in date_patterns:
            matches = re.findall(pattern, line, re.IGNORECASE)
            dates.extend(matches)
        
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
        """Parse date string for sorting purposes"""
        if not date_str:
            return datetime.min
            
        try:
            # Handle common date formats
            if 'present' in date_str.lower() or 'current' in date_str.lower():
                return datetime.now()
            
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
        
        # Parse the first line which usually contains institution and degree
        first_line = lines[0]
        institution, degree = self._parse_first_education_line(first_line)
        
        # Parse remaining lines for other information
        for line in lines[1:]:
            # Check for graduation date
            if not graduation_date:
                dates = self._extract_graduation_dates(line)
                if dates:
                    graduation_date = dates[0]
            
            # Check for GPA
            if not gpa:
                gpa_match = re.search(r'(?:gpa|grade point average):\s*([\d\.]+)', line, re.IGNORECASE)
                if gpa_match:
                    gpa = gpa_match.group(1)
            
            # Check for field of study
            if not field_of_study:
                field = self._extract_field_of_study(line)
                if field:
                    field_of_study = field
            
            # Add to achievements if it's not a date, GPA, or field of study
            if (not self._is_graduation_date_line(line) and 
                not re.search(r'(?:gpa|grade point average):\s*[\d\.]+', line, re.IGNORECASE) and
                not self._is_field_of_study_line(line) and
                line != first_line):
                achievements.append(line)
        
        # If we have an institution, create the education entry
        if institution:
            return Education(
                institution=institution,
                degree=degree,
                field_of_study=field_of_study,
                graduation_date=graduation_date,
                gpa=gpa,
                achievements=achievements
            )
        
        return None

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
        """Extract graduation dates from a line"""
        dates = []
        
        # Pattern for graduation year (typically 4 digits)
        year_pattern = r'\b(19|20)\d{2}\b'
        matches = re.findall(year_pattern, line)
        dates.extend(matches)
        
        return dates

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

    def _parse_first_education_line(self, line: str) -> Tuple[str, str]:
        """Parse the first line of an education entry"""
        institution = ""
        degree = ""
        
        # Common separators in education entries
        separators = [' - ', ' – ', ' | ', ', ']
        
        # Try to split by separators
        for separator in separators:
            if separator in line:
                parts = line.split(separator, 1)
                # First part is likely institution, second part contains degree info
                institution = parts[0].strip()
                degree_info = parts[1].strip()
                
                # Try to extract degree from degree info
                degree = self._extract_degree_from_text(degree_info)
                break
        else:
            # No separator found, treat entire line as institution
            institution = line
            degree = "Degree not specified"
        
        return institution, degree

    def _extract_degree_from_text(self, text: str) -> str:
        """Extract degree information from text"""
        text_lower = text.lower()
        
        # Check for specific degree types
        for degree_type, keywords in self.degree_types.items():
            if any(keyword in text_lower for keyword in keywords):
                return degree_type.capitalize()
        
        # If no specific degree found, return the original text
        return text if text else "Degree not specified"
