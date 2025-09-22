// client/src/components/forms/job-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Job, CreateJobRequest, JobType, ExperienceLevel, JobStatus } from '@/lib/types';
import { apiService } from '@/lib/api';
import { CacheInvalidation } from '@/lib/cache';

interface JobFormProps {
  job?: Job;
  isEdit?: boolean;
}

const JobForm = ({ job, isEdit = false }: JobFormProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requiredSkills, setRequiredSkills] = useState<string[]>(job?.required_skills || []);
  const [preferredSkills, setPreferredSkills] = useState<string[]>(job?.preferred_skills || []);
  const [newSkill, setNewSkill] = useState('');
  const [skillType, setSkillType] = useState<'required' | 'preferred'>('required');

  const [formData, setFormData] = useState({
    title: job?.title || '',
    company: job?.company || '',
    department: job?.department || '',
    location: job?.location || '',
    job_type: job?.job_type || 'full_time' as JobType,
    experience_level: job?.experience_level || 'middle' as ExperienceLevel,
    description: job?.description || '',
    salary_min: job?.salary_min || 0,
    salary_max: job?.salary_max || 0,
    currency: job?.currency || 'USD',
    status: job?.status || 'draft' as JobStatus, // Add status field
    // Use direct weight fields from backend
    weight_skills: (job?.weight_skills || 0.4) * 100, // Convert to percentage
    weight_experience: (job?.weight_experience || 0.3) * 100,
    weight_education: (job?.weight_education || 0.2) * 100,
    weight_keywords: (job?.weight_keywords || 0.1) * 100,
    responsibilities: job?.responsibilities || [''],
    requirements: job?.requirements || [''],
    nice_to_have: job?.nice_to_have || [''],
    education_requirements: job?.education_requirements || [''],
    certifications: job?.certifications || [''],
    keywords: job?.keywords || []
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Required field validations
    if (!formData.title.trim()) newErrors.title = 'Job title is required';
    if (!formData.company.trim()) newErrors.company = 'Company name is required';
    if (!formData.location.trim()) newErrors.location = 'Location is required';
    if (!formData.description.trim()) newErrors.description = 'Job description is required';
    
    // Salary validations
    if (formData.salary_min < 0) newErrors.salary_min = 'Minimum salary cannot be negative';
    if (formData.salary_max < 0) newErrors.salary_max = 'Maximum salary cannot be negative';
    if (formData.salary_max > 0 && formData.salary_min > 0 && formData.salary_min > formData.salary_max) {
      newErrors.salary_max = 'Maximum salary must be greater than or equal to minimum salary';
    }

    // Skills validation
    if (requiredSkills.length === 0) {
      newErrors.required_skills = 'At least one required skill is needed';
    }
    
    // Responsibilities validation
    const validResponsibilities = formData.responsibilities.filter(r => r.trim());
    if (validResponsibilities.length === 0) {
      newErrors.responsibilities = 'At least one responsibility is required';
    }
    
    // Requirements validation
    const validRequirements = formData.requirements.filter(r => r.trim());
    if (validRequirements.length === 0) {
      newErrors.requirements = 'At least one requirement is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted!');
    console.log('Form data:', formData);
    console.log('Required skills:', requiredSkills);
    console.log('Preferred skills:', preferredSkills);
    
    if (!validateForm()) {
      console.log('Form validation failed:', errors);
      return;
    }

    setIsLoading(true);
    try {
      const jobData: CreateJobRequest = {
        title: formData.title,
        company: formData.company,
        location: formData.location,
        job_type: formData.job_type,
        experience_level: formData.experience_level,
        description: formData.description,
        salary_min: Number(formData.salary_min) || 0,
        salary_max: Number(formData.salary_max) || 0,
        required_skills: requiredSkills,
        preferred_skills: preferredSkills,
        responsibilities: formData.responsibilities.filter(r => r.trim()),
        requirements: formData.requirements.filter(r => r.trim()),
        nice_to_have: formData.nice_to_have?.filter(n => n.trim()) || [],
        education_requirements: formData.education_requirements?.filter(e => e.trim()) || [],
        certifications: formData.certifications?.filter(c => c.trim()) || [],
        keywords: formData.keywords?.filter(k => k.trim()) || [],
        // Convert percentage weights to decimals
        weight_skills: formData.weight_skills / 100,
        weight_experience: formData.weight_experience / 100,
        weight_education: formData.weight_education / 100,
        weight_keywords: formData.weight_keywords / 100
        // Note: Status is not included in CreateJobRequest, will be set after creation if needed
      };

      console.log('Submitting job data:', JSON.stringify(jobData, null, 2));

      let result;
      if (isEdit && job) {
        console.log('Updating existing job:', job.id);
        // For editing, we can include status in the update
        const updateData = {
          ...jobData,
          status: formData.status
        };
        result = await apiService.updateJob(job.id, updateData);
        
        // Dispatch a custom event to notify the jobs page to refresh
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('jobUpdated', { detail: result }));
          // Also dispatch a general refresh event
          window.dispatchEvent(new CustomEvent('jobListRefresh'));
          // Force cache invalidation
          CacheInvalidation.onJobUpdate(result.id);
        }
      } else {
        console.log('Creating new job');
        result = await apiService.createJob(jobData);
        
        // If the status is not draft, we need to update it immediately after creation
        if (formData.status !== 'draft') {
          console.log('Updating job status to:', formData.status);
          const updatedResult = await apiService.updateJob(result.id, { status: formData.status });
          result = updatedResult; // Use the updated result
        }
        
        // Dispatch a custom event to notify the jobs page to refresh
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('jobCreated', { detail: result }));
          // Also dispatch a general refresh event
          window.dispatchEvent(new CustomEvent('jobListRefresh'));
          // Force cache invalidation
          CacheInvalidation.onJobCreate();
        }
      }
      
      // Add a small delay to ensure events are processed
      await new Promise(resolve => setTimeout(resolve, 100));
      router.push('/jobs');
    } catch (error) {
      console.error('Job creation/update error:', error);
      let errorMessage = 'Unknown error';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // Parse API error details if available
        try {
          if (error.message.includes('422')) {
            const match = error.message.match(/API Error \(422\): (.+)/);
            if (match) {
              const apiError = JSON.parse(match[1]);
              if (apiError.detail && Array.isArray(apiError.detail)) {
                errorMessage = apiError.detail.map((err: { msg: string }) => err.msg).join(', ');
              }
            }
          }
        } catch (parseError) {
          console.error('Error parsing API error:', parseError);
        }
      }
      
      console.error('Error details:', errorMessage);
      setErrors({ submit: `Failed to save job: ${errorMessage}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleWeightChange = (weight: 'weight_skills' | 'weight_experience' | 'weight_education' | 'weight_keywords', value: number) => {
    setFormData(prev => {
      const newFormData = {
        ...prev,
        [weight]: value
      };
      
      // Calculate current total
      const currentTotal = newFormData.weight_skills + newFormData.weight_experience + newFormData.weight_education + newFormData.weight_keywords;
      
      // If total is not 100%, normalize the weights
      if (Math.abs(currentTotal - 100) > 0.01) {
        const factor = 100 / currentTotal;
        newFormData.weight_skills = parseFloat((newFormData.weight_skills * factor).toFixed(2));
        newFormData.weight_experience = parseFloat((newFormData.weight_experience * factor).toFixed(2));
        newFormData.weight_education = parseFloat((newFormData.weight_education * factor).toFixed(2));
        newFormData.weight_keywords = parseFloat((newFormData.weight_keywords * factor).toFixed(2));
      }
      
      return newFormData;
    });
    
    if (errors.weights) {
      setErrors(prev => ({ ...prev, weights: '' }));
    }
  };

  const addSkill = () => {
    if (!newSkill.trim()) return;
    
    const skillToAdd = newSkill.trim();
    if (skillType === 'required') {
      if (!requiredSkills.includes(skillToAdd)) {
        setRequiredSkills([...requiredSkills, skillToAdd]);
      }
    } else {
      if (!preferredSkills.includes(skillToAdd)) {
        setPreferredSkills([...preferredSkills, skillToAdd]);
      }
    }
    setNewSkill('');
    
    if (errors.required_skills && requiredSkills.length > 0) {
      setErrors(prev => ({ ...prev, required_skills: '' }));
    }
  };

  const removeSkill = (skill: string, type: 'required' | 'preferred') => {
    if (type === 'required') {
      setRequiredSkills(requiredSkills.filter(s => s !== skill));
    } else {
      setPreferredSkills(preferredSkills.filter(s => s !== skill));
    }
  };

  const totalWeight = formData.weight_skills + formData.weight_experience + formData.weight_education + formData.weight_keywords;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">
          {isEdit ? 'Edit Job Description' : 'Create New Job Description'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Senior Software Engineer"
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company *
              </label>
              <input
                type="text"
                name="company"
                value={formData.company}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.company ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Tech Corp"
              />
              {errors.company && <p className="mt-1 text-sm text-red-600">{errors.company}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location *
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.location ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., San Francisco, CA / Remote"
              />
              {errors.location && <p className="mt-1 text-sm text-red-600">{errors.location}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Type
              </label>
              <select
                name="job_type"
                value={formData.job_type}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Select job type"
              >
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Experience Level
              </label>
              <select
                name="experience_level"
                value={formData.experience_level}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Select experience level"
              >
                <option value="entry">Entry Level</option>
                <option value="junior">Junior Level</option>
                <option value="middle">Mid Level</option>
                <option value="senior">Senior Level</option>
                <option value="lead">Lead Level</option>
                <option value="executive">Executive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Select job status"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          {/* Salary Range */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Salary ($)
              </label>
              <input
                type="number"
                name="salary_min"
                value={formData.salary_min || ''}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.salary_min ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0"
                min="0"
              />
              {errors.salary_min && <p className="mt-1 text-sm text-red-600">{errors.salary_min}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Salary ($)
              </label>
              <input
                type="number"
                name="salary_max"
                value={formData.salary_max || ''}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.salary_max ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0"
                min="0"
              />
              {errors.salary_max && <p className="mt-1 text-sm text-red-600">{errors.salary_max}</p>}
            </div>
          </div>

          {/* Job Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={6}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Describe the role, responsibilities, and requirements..."
            />
            {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
          </div>

          {/* Skills Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Skills Requirements</h3>
            
            {/* Add Skills */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter a skill..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              />
              <select
                value={skillType}
                onChange={(e) => setSkillType(e.target.value as 'required' | 'preferred')}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Select skill type"
              >
                <option value="required">Required</option>
                <option value="preferred">Preferred</option>
              </select>
              <button
                type="button"
                onClick={addSkill}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
              >
                Add
              </button>
            </div>

            {/* Required Skills */}
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Required Skills *</h4>
              <div className="flex flex-wrap gap-2">
                {requiredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill, 'required')}
                      className="ml-2 text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {errors.required_skills && <p className="mt-1 text-sm text-red-600">{errors.required_skills}</p>}
            </div>

            {/* Preferred Skills */}
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Preferred Skills</h4>
              <div className="flex flex-wrap gap-2">
                {preferredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill, 'preferred')}
                      className="ml-2 text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ATS Scoring Weights */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">ATS Scoring Weights</h3>
              <span className={`text-sm font-medium ${Math.abs(totalWeight - 100) < 0.1 ? 'text-green-600' : 'text-red-600'}`}>
                Total: {totalWeight.toFixed(1)}%
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Adjust the weights for different factors in the ATS scoring algorithm. 
              {Math.abs(totalWeight - 100) >= 0.1 ? (
                <span className="text-red-600"> Weights will be automatically normalized to total 100%.</span>
              ) : (
                <span> Total weight must equal 100%.</span>
              )}
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                { key: 'weight_skills', label: 'Skills Weight' },
                { key: 'weight_experience', label: 'Experience Weight' },
                { key: 'weight_education', label: 'Education Weight' },
                { key: 'weight_keywords', label: 'Keywords Weight' }
              ].map(({ key, label }) => {
                const value = formData[key as keyof typeof formData] as number;
                return (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {label}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={value}
                        onChange={(e) => handleWeightChange(key as 'weight_skills' | 'weight_experience' | 'weight_education' | 'weight_keywords', parseInt(e.target.value))}
                        className="flex-1"
                        title={label}
                        aria-label={label}
                      />
                      <span className="w-12 text-sm font-medium text-gray-600">{value}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {Math.abs(totalWeight - 100) >= 0.1 && (
              <p className="text-sm text-red-600">
                Total weight must equal 100%. Current weights will be automatically normalized.
              </p>
            )}
          </div>

          {/* Job Requirements - Add missing required fields */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Job Details</h3>
            
            {/* Responsibilities */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Key Responsibilities *
              </label>
              <textarea
                value={formData.responsibilities.join('\n')}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    responsibilities: value ? value.split('\n') : ['']
                  }));
                }}
                onKeyDown={(e) => {
                  // Allow Enter key to create new lines
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                  }
                }}
                rows={4}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.responsibilities ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter each responsibility on a new line...\n• Develop and maintain software applications\n• Collaborate with cross-functional teams\n• Write clean, efficient code"
              />
              {errors.responsibilities && <p className="mt-1 text-sm text-red-600">{errors.responsibilities}</p>}
            </div>

            {/* Requirements */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Requirements *
              </label>
              <textarea
                value={formData.requirements.join('\n')}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    requirements: value ? value.split('\n') : ['']
                  }));
                }}
                onKeyDown={(e) => {
                  // Allow Enter key to create new lines
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                  }
                }}
                rows={4}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.requirements ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter each requirement on a new line...\n• Bachelor's degree in Computer Science or related field\n• 3+ years of experience in software development\n• Experience with React and Node.js"
              />
              {errors.requirements && <p className="mt-1 text-sm text-red-600">{errors.requirements}</p>}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-4 pt-6 border-t">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : isEdit ? 'Update Job' : 'Create Job'}
            </button>
          </div>

          {errors.submit && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default JobForm;