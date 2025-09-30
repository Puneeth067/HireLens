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
    status: job?.status || 'draft' as JobStatus,
    weight_skills: (job?.weight_skills || 0.4) * 100,
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
        weight_skills: formData.weight_skills / 100,
        weight_experience: formData.weight_experience / 100,
        weight_education: formData.weight_education / 100,
        weight_keywords: formData.weight_keywords / 100
      };

      console.log('Submitting job data:', JSON.stringify(jobData, null, 2));

      let result;
      if (isEdit && job) {
        console.log('Updating existing job:', job.id);
        const updateData = {
          ...jobData,
          status: formData.status
        };
        result = await apiService.updateJob(job.id, updateData);
        
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('jobUpdated', { detail: result }));
          window.dispatchEvent(new CustomEvent('jobListRefresh'));
          CacheInvalidation.onJobUpdate();
        }
      } else {
        console.log('Creating new job');
        result = await apiService.createJob(jobData);
        
        if (formData.status !== 'draft') {
          console.log('Updating job status to:', formData.status);
          const updatedResult = await apiService.updateJob(result.id, { status: formData.status });
          result = updatedResult;
        }
        
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('jobCreated', { detail: result }));
          window.dispatchEvent(new CustomEvent('jobListRefresh'));
          CacheInvalidation.onJobCreate();
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      router.push('/jobs');
    } catch (error) {
      console.error('Job creation/update error:', error);
      let errorMessage = 'Unknown error';
      
      if (error instanceof Error) {
        errorMessage = error.message;
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
      
      const currentTotal = newFormData.weight_skills + newFormData.weight_experience + newFormData.weight_education + newFormData.weight_keywords;
      
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
    <div className="max-w-6xl mx-auto p-6 relative">
      {/* Floating background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute bottom-20 -left-20 w-32 h-32 bg-gradient-to-br from-indigo-200/20 to-pink-200/20 rounded-full blur-xl animate-pulse delay-700"></div>
      </div>

      <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/30 p-8 hover:shadow-3xl transition-all duration-500 hover:bg-white/90">
        {/* Header with gradient */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2 hover:from-purple-600 hover:via-pink-600 hover:to-blue-600 transition-all duration-500">
            {isEdit ? 'Edit Job Description' : 'Create New Job Description'}
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information Section */}
          <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-2xl p-6 border border-blue-100/30 hover:shadow-lg hover:border-blue-200/50 transition-all duration-300">
            <h2 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6 flex items-center">
              <span className="w-2 h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full mr-3"></span>
              Basic Information
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="transform hover:scale-[1.02] transition-transform duration-200">
                <label className="block text-sm font-medium bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent mb-2">
                  Job Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 hover:border-blue-300 bg-white/70 backdrop-blur-sm ${
                    errors.title ? 'border-red-400 focus:border-red-500' : 'border-gray-200'
                  }`}
                  placeholder="e.g., Senior Software Engineer"
                />
                {errors.title && <p className="mt-2 text-sm text-red-500 font-medium">{errors.title}</p>}
              </div>

              <div className="transform hover:scale-[1.02] transition-transform duration-200">
                <label className="block text-sm font-medium bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent mb-2">
                  Company *
                </label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 hover:border-blue-300 bg-white/70 backdrop-blur-sm ${
                    errors.company ? 'border-red-400 focus:border-red-500' : 'border-gray-200'
                  }`}
                  placeholder="e.g., Tech Corp"
                />
                {errors.company && <p className="mt-2 text-sm text-red-500 font-medium">{errors.company}</p>}
              </div>

              <div className="transform hover:scale-[1.02] transition-transform duration-200">
                <label className="block text-sm font-medium bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent mb-2">
                  Location *
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 hover:border-blue-300 bg-white/70 backdrop-blur-sm ${
                    errors.location ? 'border-red-400 focus:border-red-500' : 'border-gray-200'
                  }`}
                  placeholder="e.g., San Francisco, CA / Remote"
                />
                {errors.location && <p className="mt-2 text-sm text-red-500 font-medium">{errors.location}</p>}
              </div>

              <div className="transform hover:scale-[1.02] transition-transform duration-200">
                <label className="block text-sm font-medium bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent mb-2">
                  Job Type
                </label>
                <select
                  name="job_type"
                  value={formData.job_type}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 hover:border-blue-300 bg-white/70 backdrop-blur-sm"
                  aria-label="Select job type"
                >
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                </select>
              </div>

              <div className="transform hover:scale-[1.02] transition-transform duration-200">
                <label className="block text-sm font-medium bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent mb-2">
                  Experience Level
                </label>
                <select
                  name="experience_level"
                  value={formData.experience_level}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 hover:border-blue-300 bg-white/70 backdrop-blur-sm"
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

              <div className="transform hover:scale-[1.02] transition-transform duration-200">
                <label className="block text-sm font-medium bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent mb-2">
                  Job Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 hover:border-blue-300 bg-white/70 backdrop-blur-sm"
                  aria-label="Select job status"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Salary Range Section */}
          <div className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 rounded-2xl p-6 border border-green-100/30 hover:shadow-lg hover:border-green-200/50 transition-all duration-300">
            <h2 className="text-xl font-semibold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-6 flex items-center">
              <span className="w-2 h-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mr-3"></span>
              Salary Range
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="transform hover:scale-[1.02] transition-transform duration-200">
                <label className="block text-sm font-medium bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent mb-2">
                  Minimum Salary ($)
                </label>
                <input
                  type="number"
                  name="salary_min"
                  value={formData.salary_min || ''}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300 hover:border-green-300 bg-white/70 backdrop-blur-sm ${
                    errors.salary_min ? 'border-red-400 focus:border-red-500' : 'border-gray-200'
                  }`}
                  placeholder="0"
                  min="0"
                />
                {errors.salary_min && <p className="mt-2 text-sm text-red-500 font-medium">{errors.salary_min}</p>}
              </div>

              <div className="transform hover:scale-[1.02] transition-transform duration-200">
                <label className="block text-sm font-medium bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent mb-2">
                  Maximum Salary ($)
                </label>
                <input
                  type="number"
                  name="salary_max"
                  value={formData.salary_max || ''}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300 hover:border-green-300 bg-white/70 backdrop-blur-sm ${
                    errors.salary_max ? 'border-red-400 focus:border-red-500' : 'border-gray-200'
                  }`}
                  placeholder="0"
                  min="0"
                />
                {errors.salary_max && <p className="mt-2 text-sm text-red-500 font-medium">{errors.salary_max}</p>}
              </div>
            </div>
          </div>

          {/* Job Description Section */}
          <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/50 rounded-2xl p-6 border border-purple-100/30 hover:shadow-lg hover:border-purple-200/50 transition-all duration-300">
            <h2 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-6 flex items-center">
              <span className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mr-3"></span>
              Job Description
            </h2>
            
            <div className="transform hover:scale-[1.01] transition-transform duration-200">
              <label className="block text-sm font-medium bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent mb-2">
                Job Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={6}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-300 hover:border-purple-300 bg-white/70 backdrop-blur-sm resize-none ${
                  errors.description ? 'border-red-400 focus:border-red-500' : 'border-gray-200'
                }`}
                placeholder="Describe the role, responsibilities, and requirements..."
              />
              {errors.description && <p className="mt-2 text-sm text-red-500 font-medium">{errors.description}</p>}
            </div>
          </div>

          {/* Skills Section */}
          <div className="bg-gradient-to-br from-orange-50/50 to-red-50/50 rounded-2xl p-6 border border-orange-100/30 hover:shadow-lg hover:border-orange-200/50 transition-all duration-300">
            <h2 className="text-xl font-semibold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-6 flex items-center">
              <span className="w-2 h-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-full mr-3"></span>
              Skills Requirements
            </h2>
            
            {/* Add Skills */}
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-300 hover:border-orange-300 bg-white/70 backdrop-blur-sm"
                placeholder="Enter a skill..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              />
              <select
                value={skillType}
                onChange={(e) => setSkillType(e.target.value as 'required' | 'preferred')}
                className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-300 hover:border-orange-300 bg-white/70 backdrop-blur-sm"
                aria-label="Select skill type"
              >
                <option value="required">Required</option>
                <option value="preferred">Preferred</option>
              </select>
              <button
                type="button"
                onClick={addSkill}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 focus:ring-4 focus:ring-orange-500/20 transform hover:scale-105 hover:shadow-lg transition-all duration-300 font-medium"
              >
                Add
              </button>
            </div>

            {/* Required Skills */}
            <div className="mb-6">
              <h4 className="font-medium bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent mb-3">Required Skills *</h4>
              <div className="flex flex-wrap gap-2">
                {requiredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-red-100 to-pink-100 text-red-800 rounded-full text-sm font-medium border border-red-200 hover:shadow-md hover:scale-105 transition-all duration-200"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill, 'required')}
                      className="ml-2 text-red-600 hover:text-red-800 hover:bg-red-200 rounded-full p-1 transition-all duration-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {errors.required_skills && <p className="mt-2 text-sm text-red-500 font-medium">{errors.required_skills}</p>}
            </div>

            {/* Preferred Skills */}
            <div>
              <h4 className="font-medium bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent mb-3">Preferred Skills</h4>
              <div className="flex flex-wrap gap-2">
                {preferredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 rounded-full text-sm font-medium border border-green-200 hover:shadow-md hover:scale-105 transition-all duration-200"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill, 'preferred')}
                      className="ml-2 text-green-600 hover:text-green-800 hover:bg-green-200 rounded-full p-1 transition-all duration-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ATS Scoring Weights */}
          <div className="bg-gradient-to-br from-indigo-50/50 to-blue-50/50 rounded-2xl p-6 border border-indigo-100/30 hover:shadow-lg hover:border-indigo-200/50 transition-all duration-300">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent flex items-center">
                <span className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full mr-3"></span>
                ATS Scoring Weights
              </h2>
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${Math.abs(totalWeight - 100) < 0.1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                Total: {totalWeight.toFixed(1)}%
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Adjust the weights for different factors in the ATS scoring algorithm. 
              {Math.abs(totalWeight - 100) >= 0.1 ? (
                <span className="text-red-600 font-medium"> Weights will be automatically normalized to total 100%.</span>
              ) : (
                <span> Total weight must equal 100%.</span>
              )}
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                { key: 'weight_skills', label: 'Skills Weight', color: 'from-blue-500 to-indigo-500' },
                { key: 'weight_experience', label: 'Experience Weight', color: 'from-purple-500 to-pink-500' },
                { key: 'weight_education', label: 'Education Weight', color: 'from-green-500 to-emerald-500' },
                { key: 'weight_keywords', label: 'Keywords Weight', color: 'from-orange-500 to-red-500' }
              ].map(({ key, label, color }) => {
                const value = formData[key as keyof typeof formData] as number;
                return (
                  <div key={key} className="transform hover:scale-[1.02] transition-transform duration-200">
                    <label className="block text-sm font-medium bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent mb-3">
                      {label}
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={value}
                        onChange={(e) => handleWeightChange(key as 'weight_skills' | 'weight_experience' | 'weight_education' | 'weight_keywords', parseInt(e.target.value))}
                        className="flex-1 h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        title={label}
                        aria-label={label}
                        style={{
                          background: `linear-gradient(to right, rgb(59, 130, 246) 0%, rgb(59, 130, 246) ${value}%, rgb(229, 231, 235) ${value}%, rgb(229, 231, 235) 100%)`
                        }}
                      />
                      <span className={`w-14 text-sm font-bold text-center py-1 px-2 rounded-lg bg-gradient-to-r ${color} text-white`}>
                        {value}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {Math.abs(totalWeight - 100) >= 0.1 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700 font-medium">
                  Total weight must equal 100%. Current weights will be automatically normalized.
                </p>
              </div>
            )}
          </div>

          {/* Job Details Section */}
          <div className="bg-gradient-to-br from-cyan-50/50 to-teal-50/50 rounded-2xl p-6 border border-cyan-100/30 hover:shadow-lg hover:border-cyan-200/50 transition-all duration-300">
            <h2 className="text-xl font-semibold bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent mb-6 flex items-center">
              <span className="w-2 h-2 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full mr-3"></span>
              Job Details
            </h2>
            
            {/* Responsibilities */}
            <div className="mb-6 transform hover:scale-[1.01] transition-transform duration-200">
              <label className="block text-sm font-medium bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent mb-2">
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
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                  }
                }}
                rows={5}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all duration-300 hover:border-cyan-300 bg-white/70 backdrop-blur-sm resize-none ${
                  errors.responsibilities ? 'border-red-400 focus:border-red-500' : 'border-gray-200'
                }`}
                placeholder="Enter each responsibility on a new line...&#10;• Develop and maintain software applications&#10;• Collaborate with cross-functional teams&#10;• Write clean, efficient code"
              />
              {errors.responsibilities && <p className="mt-2 text-sm text-red-500 font-medium">{errors.responsibilities}</p>}
            </div>

            {/* Requirements */}
            <div className="transform hover:scale-[1.01] transition-transform duration-200">
              <label className="block text-sm font-medium bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent mb-2">
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
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                  }
                }}
                rows={5}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all duration-300 hover:border-cyan-300 bg-white/70 backdrop-blur-sm resize-none ${
                  errors.requirements ? 'border-red-400 focus:border-red-500' : 'border-gray-200'
                }`}
                placeholder="Enter each requirement on a new line...&#10;• Bachelor's degree in Computer Science or related field&#10;• 3+ years of experience in software development&#10;• Experience with React and Node.js"
              />
              {errors.requirements && <p className="mt-2 text-sm text-red-500 font-medium">{errors.requirements}</p>}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-4 pt-8 border-t-2 border-gradient-to-r from-gray-200 to-gray-300">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-8 py-3 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:ring-4 focus:ring-gray-500/20 transform hover:scale-105 hover:shadow-lg transition-all duration-300 font-medium bg-white/70 backdrop-blur-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 hover:shadow-xl transition-all duration-300 font-medium disabled:transform-none"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                isEdit ? 'Update Job' : 'Create Job'
              )}
            </button>
          </div>

          {errors.submit && (
            <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-xl transform hover:scale-[1.01] transition-transform duration-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="ml-3 text-sm text-red-700 font-medium">{errors.submit}</p>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Floating success indicator */}
      <div className="fixed bottom-8 left-8 opacity-0 hover:opacity-100 transition-opacity duration-300">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
          ✓ Auto-save enabled
        </div>
      </div>
    </div>
  );
};

export default JobForm;