'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cachedApiService } from '@/lib/cached-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Plus, X, Loader2, ArrowLeft, Award } from 'lucide-react'
import { Job, RankingCriteria } from '@/lib/types'
import { toast } from 'sonner'

export default function CreateRankingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const jobId = searchParams.get('job')

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [criteria, setCriteria] = useState<RankingCriteria>({
    skills_weight: 0.4,
    experience_weight: 0.3,
    education_weight: 0.2,
    keyword_weight: 0.1,
    require_degree: false,
    required_skills: [],
    preferred_skills: [],
  })
  const [newRequiredSkill, setNewRequiredSkill] = useState('')
  const [newPreferredSkill, setNewPreferredSkill] = useState('')

  useEffect(() => {
    if (jobId) {
      fetchJobDetails(jobId)
    } else {
      toast.error('No job ID provided for ranking creation.')
      router.push('/ranking')
    }
  }, [jobId, router])

  const fetchJobDetails = async (id: string) => {
    try {
      const data = await cachedApiService.getJob(id)
      setJob(data)
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch job details:', error)
      toast.error('Failed to load job details. Please try again.')
      router.push('/ranking')
    }
  }

  const handleWeightChange = (key: keyof RankingCriteria, value: number[]) => {
    setCriteria(prev => {
      const newCriteria = { ...prev, [key]: value[0] / 100 }
      const totalWeight = (newCriteria.skills_weight || 0) +
                          (newCriteria.experience_weight || 0) +
                          (newCriteria.education_weight || 0) +
                          (newCriteria.keyword_weight || 0)
      
      // Normalize weights if they exceed 1.0 (100%)
      if (totalWeight > 1.0001) { // Allow for floating point inaccuracies
        const factor = 1.0 / totalWeight
        newCriteria.skills_weight = (newCriteria.skills_weight || 0) * factor
        newCriteria.experience_weight = (newCriteria.experience_weight || 0) * factor
        newCriteria.education_weight = (newCriteria.education_weight || 0) * factor
        newCriteria.keyword_weight = (newCriteria.keyword_weight || 0) * factor
      }
      return newCriteria
    })
  }

  const addSkill = (type: 'required' | 'preferred', skill: string) => {
    const skillTrimmed = skill.trim()
    if (skillTrimmed && type === 'required' && !criteria.required_skills.includes(skillTrimmed)) {
      setCriteria(prev => ({
        ...prev,
        required_skills: [...prev.required_skills, skillTrimmed],
      }))
      setNewRequiredSkill('')
    } else if (skillTrimmed && type === 'preferred' && !criteria.preferred_skills.includes(skillTrimmed)) {
      setCriteria(prev => ({
        ...prev,
        preferred_skills: [...prev.preferred_skills, skillTrimmed],
      }))
      setNewPreferredSkill('')
    }
  }

  const removeSkill = (type: 'required' | 'preferred', skillToRemove: string) => {
    if (type === 'required') {
      setCriteria(prev => ({
        ...prev,
        required_skills: prev.required_skills.filter(skill => skill !== skillToRemove),
      }))
    } else {
      setCriteria(prev => ({
        ...prev,
        preferred_skills: prev.preferred_skills.filter(skill => skill !== skillToRemove),
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!jobId) {
      toast.error('Job ID is missing.')
      return
    }

    setSubmitting(true)
    try {
      // Fetch job details to check if it has associated resumes
      const jobDetails = await cachedApiService.getJob(jobId);
      console.log('Job details:', jobDetails);
      
      let resumeIds: string[] = [];
      
      // Check if job has associated resumes
      if (jobDetails.resumes && jobDetails.resumes.length > 0) {
        console.log('Using resume IDs from job.resumes:', jobDetails.resumes);
        resumeIds = jobDetails.resumes;
      } else {
        // Fallback: Fetch all parsed resumes and filter for completed ones
        const parsedResumesResponse = await cachedApiService.getParsedResumes();
        const parsedResumes = parsedResumesResponse.resumes;
        console.log('All parsed resumes:', parsedResumes);
        
        // Filter resumes that are completed
        const jobResumes = parsedResumes.filter(resume => 
          resume.parsing_status === 'completed'
        );
        
        resumeIds = jobResumes.map(resume => resume.id);
        console.log('Filtered resume IDs for job:', resumeIds);
        console.log('Number of resumes for job:', resumeIds.length);
      }

      if (resumeIds.length === 0) {
        toast.info('No parsed resumes found for this job. Please upload and parse resumes first.')
      }

      // Log the criteria being sent
      console.log('Ranking criteria:', criteria);
      
      const response = await cachedApiService.createRanking(jobId, resumeIds, criteria)
      console.log('API Response for createRanking:', response)
      if (response.ranking_id && response.ranking_id !== '') {
        toast.success('Custom ranking created successfully!')
        console.log('Redirecting to ranking page...')
        router.push(`/ranking?job=${jobId}`) // Redirect to the main ranking page for the job
      } else {
        toast.error('Failed to create custom ranking. Please check that all required information is provided and try again.')
        console.error('Ranking creation failed. Response:', response)
      }
    } catch (error) {
      console.error('Error creating ranking:', error)
      // Add more specific error handling
      if (error instanceof Error) {
        console.error('Error details:', error.message)
        // Show a more user-friendly error message
        if (error.message.includes('404')) {
          toast.error('Job not found. Please make sure the job still exists.')
        } else if (error.message.includes('400')) {
          toast.error('Invalid request. Please check your input and try again.')
        } else if (error.message.includes('Network error') || error.message.includes('Failed to fetch')) {
          toast.error('Unable to connect to the server. Please check your connection and try again.')
        } else if (error.message.includes('No comparisons found') || error.message.includes('No resumes found')) {
          toast.error('No resumes have been uploaded yet. Please upload and parse resumes first.')
        } else {
          toast.error(`Error: ${error.message}`)
        }
      } else {
        toast.error('An unexpected error occurred while creating the ranking. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="ml-2 text-gray-600">Loading job details...</p>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-red-500">Job not found or an error occurred.</p>
      </div>
    )
  }

  const totalWeightPercentage = ((criteria.skills_weight || 0) +
                                 (criteria.experience_weight || 0) +
                                 (criteria.education_weight || 0) +
                                 (criteria.keyword_weight || 0)) * 100

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Customize Ranking</h1>
            <p className="text-gray-600">
              Define custom criteria to rank candidates for <span className="font-semibold">{job.title}</span>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Note: Rankings are automatically created when you select a job on the main ranking page. 
              Use this page only if you need to customize the ranking criteria.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Job Information</CardTitle>
            <p className="text-sm text-gray-600">
              Job details for <span className="font-semibold">{job.title}</span> at {job.company}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Position</Label>
                <p className="font-medium">{job.title}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Company</Label>
                <p className="font-medium">{job.company}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Location</Label>
                <p className="font-medium">{job.location}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Experience Level</Label>
                <p className="font-medium capitalize">
                  {job.experience_level?.split('_').join(' ') || 'Not specified'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Ranking Criteria</CardTitle>
            <p className="text-sm text-gray-600">
              Adjust the weights for different factors in the ranking algorithm. Total weight must equal 100%.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-sm font-medium text-gray-700">Skills Weight</Label>
                <span className="text-sm font-medium text-gray-900">
                  {Math.round((criteria.skills_weight || 0) * 100)}%
                </span>
              </div>
              <Slider
                value={[(criteria.skills_weight || 0) * 100]}
                onValueChange={(value) => handleWeightChange('skills_weight', value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-sm font-medium text-gray-700">Experience Weight</Label>
                <span className="text-sm font-medium text-gray-900">
                  {Math.round((criteria.experience_weight || 0) * 100)}%
                </span>
              </div>
              <Slider
                value={[(criteria.experience_weight || 0) * 100]}
                onValueChange={(value) => handleWeightChange('experience_weight', value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-sm font-medium text-gray-700">Education Weight</Label>
                <span className="text-sm font-medium text-gray-900">
                  {Math.round((criteria.education_weight || 0) * 100)}%
                </span>
              </div>
              <Slider
                value={[(criteria.education_weight || 0) * 100]}
                onValueChange={(value) => handleWeightChange('education_weight', value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-sm font-medium text-gray-700">Keyword Weight</Label>
                <span className="text-sm font-medium text-gray-900">
                  {Math.round((criteria.keyword_weight || 0) * 100)}%
                </span>
              </div>
              <Slider
                value={[(criteria.keyword_weight || 0) * 100]}
                onValueChange={(value) => handleWeightChange('keyword_weight', value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Total Weight</span>
                <span className={`text-sm font-medium ${Math.abs(totalWeightPercentage - 100) < 0.1 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalWeightPercentage.toFixed(1)}%
                </span>
              </div>
              {Math.abs(totalWeightPercentage - 100) >= 0.1 && (
                <p className="text-sm text-red-600 mt-1">
                  Total weight must equal 100%. Current weights will be automatically normalized.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Required Skills</CardTitle>
            <p className="text-sm text-gray-600">
              Candidates must have these skills to be considered for ranking.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-3">
              <Input
                value={newRequiredSkill}
                onChange={(e) => setNewRequiredSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (newRequiredSkill.trim()) {
                      addSkill('required', newRequiredSkill);
                    }
                  }
                }}
                placeholder="Add required skill"
                className="flex-1"
              />
              <Button
                type="button"
                onClick={() => {
                  if (newRequiredSkill.trim()) {
                    addSkill('required', newRequiredSkill);
                  }
                }}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {criteria.required_skills.map((skill) => (
                <Badge key={skill} variant="default" className="px-3 py-1.5 text-sm">
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill('required', skill)}
                    className="ml-2 hover:bg-red-600 rounded-full p-0.5"
                    aria-label={`Remove ${skill} skill`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {criteria.required_skills.length === 0 && (
                <p className="text-sm text-gray-500 italic">No required skills added</p>
              )}
            </div>

          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Preferred Skills</CardTitle>
            <p className="text-sm text-gray-600">
              Candidates with these skills will receive higher rankings.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-3">
              <Input
                value={newPreferredSkill}
                onChange={(e) => setNewPreferredSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (newPreferredSkill.trim()) {
                      addSkill('preferred', newPreferredSkill);
                    }
                  }
                }}
                placeholder="Add preferred skill"
                className="flex-1"
              />
              <Button
                type="button"
                onClick={() => {
                  if (newPreferredSkill.trim()) {
                    addSkill('preferred', newPreferredSkill);
                  }
                }}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {criteria.preferred_skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="px-3 py-1.5 text-sm">
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill('preferred', skill)}
                    className="ml-2 hover:bg-gray-600 rounded-full p-0.5"
                    aria-label={`Remove ${skill} skill`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {criteria.preferred_skills.length === 0 && (
                <p className="text-sm text-gray-500 italic">No preferred skills added</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Additional Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="require_degree"
                checked={criteria.require_degree}
                onCheckedChange={(checked) => 
                  setCriteria(prev => ({ ...prev, require_degree: !!checked }))
                }
              />
              <Label htmlFor="require_degree" className="text-sm font-medium text-gray-700">
                Require degree or equivalent qualification
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || Math.abs(totalWeightPercentage - 100) >= 0.1}
            className="flex items-center gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Custom Ranking
          </Button>
        </div>
      </form>
    </div>
  )
}