"""
Enhanced File Service
Handles file operations, metadata storage, and parsed data management
"""
import os
import json
import uuid
import shutil
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

class FileService:
    def __init__(self):
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.data_dir = Path(settings.UPLOAD_DIR)
        self.metadata_file = self.data_dir / "file_metadata.json"
        self.parsed_data_dir = self.data_dir / "parsed_resumes"
        
        # Create directories if they don't exist
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.parsed_data_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize metadata file if it doesn't exist
        if not self.metadata_file.exists():
            self._save_metadata({})
    
    def _load_metadata(self) -> Dict[str, Dict[str, Any]]:
        """Load file metadata from JSON file"""
        try:
            if self.metadata_file.exists():
                with open(self.metadata_file, 'r') as f:
                    return json.load(f)
            return {}
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Error loading metadata: {e}")
            return {}
    
    def _save_metadata(self, metadata: Dict[str, Dict[str, Any]]) -> None:
        """Save file metadata to JSON file"""
        try:
            with open(self.metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2, default=str)
        except IOError as e:
            logger.error(f"Error saving metadata: {e}")
            raise
    
    def save_file(self, file_content: bytes, original_filename: str) -> Dict[str, Any]:
        """Save uploaded file and create metadata"""
        try:
            # Generate unique file ID and filename
            file_id = str(uuid.uuid4())
            file_extension = Path(original_filename).suffix
            unique_filename = f"{file_id}{file_extension}"
            file_path = self.upload_dir / unique_filename
            
            # Save file
            with open(file_path, 'wb') as f:
                f.write(file_content)
            
            # Create metadata
            metadata = {
                'file_id': file_id,
                'original_filename': original_filename,
                'filename': unique_filename,
                'file_size': len(file_content),
                'file_type': file_extension.lower(),
                'uploaded_at': datetime.now().timestamp(),
                'status': 'pending',
                'error_message': None,
                'parsed_at': None,
                'processing_time': None
            }
            
            # Save to metadata store
            all_metadata = self._load_metadata()
            all_metadata[file_id] = metadata
            self._save_metadata(all_metadata)
            
            logger.info(f"File saved successfully: {original_filename} -> {unique_filename}")
            return metadata
            
        except Exception as e:
            logger.error(f"Error saving file {original_filename}: {e}")
            raise
    
    def get_file_metadata(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a specific file"""
        metadata = self._load_metadata()
        return metadata.get(file_id)
    
    def get_all_files(self) -> List[Dict[str, Any]]:
        """Get metadata for all files"""
        metadata = self._load_metadata()
        return list(metadata.values())
    
    def update_file_status(self, file_id: str, status: str, error_message: Optional[str] = None) -> bool:
        """Update file processing status"""
        try:
            metadata = self._load_metadata()
            if file_id not in metadata:
                return False
            
            metadata[file_id]['status'] = status
            if error_message:
                metadata[file_id]['error_message'] = error_message
            
            if status == 'processing':
                metadata[file_id]['processing_started_at'] = datetime.now().timestamp()
            elif status in ['completed', 'error']:
                metadata[file_id]['parsed_at'] = datetime.now().timestamp()
                if 'processing_started_at' in metadata[file_id]:
                    start_time = metadata[file_id]['processing_started_at']
                    metadata[file_id]['processing_time'] = datetime.now().timestamp() - start_time
            
            self._save_metadata(metadata)
            return True
            
        except Exception as e:
            logger.error(f"Error updating file status for {file_id}: {e}")
            return False
    
    def delete_file(self, file_id: str) -> bool:
        """Delete file and its metadata"""
        try:
            print(f"File service delete_file called for file_id: {file_id}")  # Debug log
            metadata = self._load_metadata()
            if file_id not in metadata:
                print(f"File ID {file_id} not found in metadata")  # Debug log
                return False
            
            file_info = metadata[file_id]
            print(f"Deleting file: {file_info['filename']}")  # Debug log
            
            # Delete physical file
            file_path = self.upload_dir / file_info['filename']
            if file_path.exists():
                file_path.unlink()
                print(f"Physical file deleted: {file_path}")  # Debug log
            
            # Delete parsed data if exists
            parsed_data_file = self.parsed_data_dir / f"{file_id}.json"
            if parsed_data_file.exists():
                parsed_data_file.unlink()
                print(f"Parsed data file deleted: {parsed_data_file}")  # Debug log
            
            # Remove from metadata
            del metadata[file_id]
            self._save_metadata(metadata)
            print(f"Metadata entry removed for file_id: {file_id}")  # Debug log
            
            logger.info(f"File deleted successfully: {file_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting file {file_id}: {e}")
            return False
    
    def save_parsed_data(self, file_id: str, parsed_data: Dict[str, Any]) -> bool:
        """Save parsed resume data"""
        try:
            parsed_file = self.parsed_data_dir / f"{file_id}.json"
            
            # Add metadata
            parsed_data['file_id'] = file_id
            parsed_data['saved_at'] = datetime.now().isoformat()
            
            # Ensure the status in parsed data matches the file metadata status
            file_metadata = self.get_file_metadata(file_id)
            if file_metadata and 'status' in file_metadata:
                parsed_data['status'] = file_metadata['status']
            
            with open(parsed_file, 'w') as f:
                json.dump(parsed_data, f, indent=2, default=str)
            
            logger.info(f"Parsed data saved for file: {file_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving parsed data for {file_id}: {e}")
            return False
    
    def get_parsed_data(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get parsed resume data for a file"""
        try:
            parsed_file = self.parsed_data_dir / f"{file_id}.json"
            if not parsed_file.exists():
                return None
            
            with open(parsed_file, 'r') as f:
                return json.load(f)
                
        except Exception as e:
            logger.error(f"Error loading parsed data for {file_id}: {e}")
            return None
    
    def get_file_path(self, file_id: str) -> Optional[Path]:
        """Get the physical file path for a file ID"""
        metadata = self.get_file_metadata(file_id)
        if not metadata:
            return None
        
        file_path = self.upload_dir / metadata['filename']
        return file_path if file_path.exists() else None
    
    def get_file_stats(self) -> Dict[str, Any]:
        """Get statistics about all files"""
        all_files = self.get_all_files()
        
        stats = {
            'total_files': len(all_files),
            'completed': 0,
            'processing': 0,
            'pending': 0,
            'error': 0,
            'total_size': 0,
            'recent_activity': []
        }
        
        for file_data in all_files:
            status = file_data.get('status', 'pending')
            stats[status] = stats.get(status, 0) + 1
            stats['total_size'] += file_data.get('file_size', 0)
            
            # Add to recent activity if processed recently
            if file_data.get('parsed_at'):
                stats['recent_activity'].append({
                    'file_id': file_data['file_id'],
                    'filename': file_data.get('original_filename', ''),
                    'status': status,
                    'parsed_at': file_data.get('parsed_at')
                })
        
        # Sort recent activity by date
        stats['recent_activity'].sort(
            key=lambda x: x.get('parsed_at', 0), 
            reverse=True
        )
        stats['recent_activity'] = stats['recent_activity'][:10]
        
        return stats
    
    def bulk_delete_files(self, file_ids: List[str]) -> Dict[str, List[str]]:
        """Delete multiple files"""
        print(f"Bulk delete files called with file_ids: {file_ids}")  # Debug log
        deleted = []
        failed = []
        
        for file_id in file_ids:
            try:
                print(f"Bulk deleting file_id: {file_id}")  # Debug log
                if self.delete_file(file_id):
                    deleted.append(file_id)
                    print(f"File {file_id} deleted successfully")  # Debug log
                else:
                    failed.append(file_id)
                    print(f"Failed to delete file {file_id}")  # Debug log
            except Exception as e:
                logger.error(f"Error deleting file {file_id}: {e}")
                failed.append(file_id)
        
        result = {'deleted': deleted, 'failed': failed}
        print(f"Bulk delete result: {result}")  # Debug log
        return result
    
    def bulk_update_status(self, updates: List[Dict[str, str]]) -> Dict[str, List[str]]:
        """Update status for multiple files"""
        updated = []
        failed = []
        
        for update in updates:
            file_id = update.get('file_id')
            status = update.get('status')
            error_message = update.get('error_message')
            
            if not file_id or not status:
                failed.append(file_id or 'unknown')
                continue
            
            try:
                if self.update_file_status(file_id, status, error_message):
                    updated.append(file_id)
                else:
                    failed.append(file_id)
            except Exception as e:
                logger.error(f"Error updating status for {file_id}: {e}")
                failed.append(file_id)
        
        return {'updated': updated, 'failed': failed}
    
    def search_files(self, query: str, status_filter: Optional[List[str]] = None, 
                    date_range: Optional[Dict[str, datetime]] = None) -> List[Dict[str, Any]]:
        """Search files by query and filters"""
        all_files = self.get_all_files()
        results = []
        
        query_lower = query.lower()
        
        for file_data in all_files:
            # Status filter
            if status_filter and file_data.get('status') not in status_filter:
                continue
            
            # Date range filter
            if date_range:
                file_date = datetime.fromtimestamp(file_data.get('uploaded_at', 0))
                if 'start' in date_range and file_date < date_range['start']:
                    continue
                if 'end' in date_range and file_date > date_range['end']:
                    continue
            
            # Text search
            if query:
                filename = file_data.get('original_filename', '').lower()
                if query_lower not in filename:
                    # Could also search in parsed data content
                    parsed_data = self.get_parsed_data(file_data['file_id'])
                    if parsed_data:
                        raw_text = parsed_data.get('raw_text', '').lower()
                        if query_lower not in raw_text:
                            continue
                    else:
                        continue
            
            results.append(file_data)
        
        return results
    
    def get_file_preview(self, file_id: str, max_chars: int = 1000) -> Optional[Dict[str, Any]]:
        """Get a preview of file content"""
        try:
            file_metadata = self.get_file_metadata(file_id)
            if not file_metadata:
                return None
            
            parsed_data = self.get_parsed_data(file_id)
            content_preview = ""
            
            if parsed_data and 'raw_text' in parsed_data:
                content_preview = parsed_data['raw_text'][:max_chars]
                if len(parsed_data['raw_text']) > max_chars:
                    content_preview += "..."
            
            return {
                'filename': file_metadata.get('original_filename', ''),
                'content_preview': content_preview,
                'metadata': file_metadata
            }
            
        except Exception as e:
            logger.error(f"Error getting file preview for {file_id}: {e}")
            return None
    
    def cleanup_orphaned_files(self) -> Dict[str, int]:
        """Clean up orphaned files and data"""
        print("Cleanup orphaned files called")  # Debug log
        metadata = self._load_metadata()
        cleaned = {'files': 0, 'parsed_data': 0, 'metadata_entries': 0}
        
        # If metadata is empty, don't delete all files (this would be catastrophic)
        if not metadata:
            logger.warning("Metadata is empty. Skipping cleanup to prevent data loss.")
            print("Metadata is empty. Skipping cleanup to prevent data loss.")  # Debug log
            return cleaned
        
        # Clean up physical files without metadata
        for file_path in self.upload_dir.iterdir():
            if file_path.is_file() and file_path.name != 'file_metadata.json':  # Don't delete the metadata file itself
                file_id = file_path.stem  # filename without extension
                if not any(meta.get('filename') == file_path.name for meta in metadata.values()):
                    try:
                        file_path.unlink()
                        cleaned['files'] += 1
                        logger.info(f"Cleaned up orphaned file: {file_path.name}")
                        print(f"Cleaned up orphaned file: {file_path.name}")  # Debug log
                    except Exception as e:
                        logger.error(f"Error cleaning up file {file_path.name}: {e}")
        
        # Clean up parsed data without corresponding metadata
        for parsed_file in self.parsed_data_dir.iterdir():
            if parsed_file.is_file() and parsed_file.suffix == '.json':
                file_id = parsed_file.stem
                if file_id not in metadata:
                    try:
                        parsed_file.unlink()
                        cleaned['parsed_data'] += 1
                        logger.info(f"Cleaned up orphaned parsed data: {parsed_file.name}")
                        print(f"Cleaned up orphaned parsed data: {parsed_file.name}")  # Debug log
                    except Exception as e:
                        logger.error(f"Error cleaning up parsed data {parsed_file.name}: {e}")
        
        # Clean up metadata entries without physical files
        updated_metadata = {}
        for file_id, file_metadata in metadata.items():
            file_path = self.upload_dir / file_metadata.get('filename', '')
            if file_path.exists():
                updated_metadata[file_id] = file_metadata
            else:
                cleaned['metadata_entries'] += 1
                logger.info(f"Cleaned up orphaned metadata entry: {file_id}")
                print(f"Cleaned up orphaned metadata entry: {file_id}")  # Debug log
        
        if cleaned['metadata_entries'] > 0:
            self._save_metadata(updated_metadata)
        
        print(f"Cleanup result: {cleaned}")  # Debug log
        return cleaned
    
    def export_metadata(self, file_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """Export metadata for specified files or all files"""
        all_metadata = self._load_metadata()
        
        if file_ids:
            filtered_metadata = {fid: all_metadata[fid] for fid in file_ids if fid in all_metadata}
        else:
            filtered_metadata = all_metadata
        
        return {
            'export_date': datetime.now().isoformat(),
            'total_files': len(filtered_metadata),
            'files': filtered_metadata
        }
    
    def scan_and_register_existing_files(self) -> Dict[str, int]:
        """Scan uploads/resumes directory and register any unregistered files"""
        resumes_dir = self.upload_dir / "resumes"
        if not resumes_dir.exists():
            return {'registered': 0, 'skipped': 0, 'errors': 0}
        
        metadata = self._load_metadata()
        registered = 0
        skipped = 0
        errors = 0
        
        # Get list of already registered filenames
        registered_filenames = {meta['filename'] for meta in metadata.values()}
        
        # Scan resumes directory
        for file_path in resumes_dir.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in ['.pdf', '.docx']:
                # Check if already registered
                if file_path.name in registered_filenames:
                    skipped += 1
                    continue
                
                try:
                    # Read file content
                    with open(file_path, 'rb') as f:
                        file_content = f.read()
                    
                    # Generate file ID and create metadata (similar to save_file)
                    file_id = str(uuid.uuid4())
                    original_filename = file_path.name
                    file_extension = file_path.suffix
                    unique_filename = f"{file_id}{file_extension}"
                    
                    # Move file to main upload directory
                    new_file_path = self.upload_dir / unique_filename
                    with open(new_file_path, 'wb') as f:
                        f.write(file_content)
                    
                    # Remove original file
                    file_path.unlink()
                    
                    # Create metadata
                    file_metadata = {
                        'file_id': file_id,
                        'original_filename': original_filename,
                        'filename': unique_filename,
                        'file_size': len(file_content),
                        'file_type': file_extension.lower(),
                        'uploaded_at': datetime.now().timestamp(),
                        'status': 'pending',
                        'error_message': None,
                        'parsed_at': None,
                        'processing_time': None
                    }
                    
                    # Save to metadata
                    metadata[file_id] = file_metadata
                    registered += 1
                    
                except Exception as e:
                    logger.error(f"Error registering file {file_path.name}: {e}")
                    errors += 1
        
        # Save updated metadata
        if registered > 0:
            self._save_metadata(metadata)
        
        return {'registered': registered, 'skipped': skipped, 'errors': errors}
