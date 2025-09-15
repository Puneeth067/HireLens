// client/src/components/forms/job-form.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Job, CreateJobRequest, JobType, ExperienceLevel } from '@/lib/types';
import { createJob, updateJob } from '@/lib/api';

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
    location: job?.location || '',
    job_type: job?.job_type || 'full_time' as JobType,
    experience_level: job?.experience_level || 'mid' as ExperienceLevel,
    description: job?.description || '',
    salary_min: job?.salary_min || 0,
    salary_max: job?.salary_max || 0,
    ats_weights: {
      skills_weight: job?.ats_weights?.skills_weight || 40,
      experience_weight: job?.ats_weights?.experience_weight || 30,
      education_weight: job?.ats_weights?.education_weight || 15,
      keywords_weight: job?.ats_weights?.keywords_weight || 15
    }
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) newErrors.title = 'Job title is required';
    if (!formData.company.trim()) newErrors.company = 'Company name is required';
    if (!formData.location.trim()) newErrors.location = 'Location is required';
    if (!formData.description.trim()) newErrors.description = 'Job description is required';
    
    if (formData.salary_min < 0) newErrors.salary_min = 'Minimum salary cannot be negative';
    if (formData.salary_max < 0) newErrors.salary_max = 'Maximum salary cannot be negative';
    if (formData.salary_max > 0 && formData.salary_min > formData.salary_max) {
      newErrors.salary_max = 'Maximum salary must be greater than minimum';
    }

    const totalWeight = Object.values(formData.ats_weights).reduce((sum, weight) => sum + weight, 0);
    if (totalWeight !== 100) {
      newErrors.ats_weights = 'ATS weights must sum to 100%';
    }

    if (requiredSkills.length === 0) {
      newErrors.required_skills = 'At least one required skill is needed';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const jobData: CreateJobRequest = {
        ...formData,
        required_skills: requiredSkills,
        preferred_skills: preferredSkills
      };

      if (isEdit && job) {
        await updateJob(job.id, jobData);
      } else {
        await createJob(jobData);
      }

      router.push('/jobs');
    } catch (error) {
      setErrors({ submit: 'Failed to save job. Please try again.' });
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

  const handleWeightChange = (weight: keyof typeof formData.ats_weights, value: number) => {
    setFormData(prev => ({
      ...prev,
      ats_weights: {
        ...prev.ats_weights,
        [weight]: value
      }
    }));
    if (errors.ats_weights) {
      setErrors(prev => ({ ...prev, ats_weights: '' }));
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

  const totalWeight = Object.values(formData.ats_weights).reduce((sum, weight) => sum + weight, 0);

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
                <option value="mid">Mid Level</option>
                <option value="senior">Senior Level</option>
                <option value="executive">Executive</option>
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
              <span className={`text-sm font-medium ${totalWeight === 100 ? 'text-green-600' : 'text-red-600'}`}>
                Total: {totalWeight}%
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {Object.entries(formData.ats_weights).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={value}
                      onChange={(e) => handleWeightChange(key as keyof typeof formData.ats_weights, parseInt(e.target.value))}
                      className="flex-1"
                      title={`${key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} Weight`}
                      aria-label={`${key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} Weight`}
                    />
                    <span className="w-12 text-sm font-medium text-gray-600">{value}%</span>
                  </div>
                </div>
              ))}
            </div>
            {errors.ats_weights && <p className="mt-1 text-sm text-red-600">{errors.ats_weights}</p>}
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