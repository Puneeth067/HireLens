
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
import { Job, JobDescriptionResponse, RankingCriteria } from '@/lib/types'
import { toast } from 'sonner'

export default function CreateRankingPage() {
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
      // Fetch all resumes associated with the job
      const jobDetails = await cachedApiService.getJob(jobId);
      console.log('Job details:', jobDetails);
      // The resumes property is already an array of resume IDs, no need to map
      const resumeIds = jobDetails.resumes;
      console.log('Resume IDs:', resumeIds);
      console.log('Number of resumes:', resumeIds.length);

      if (resumeIds.length === 0) {
        toast.info('No existing comparisons found for this job. The system will automatically create comparisons for all parsed resumes.')
      }

      // Log the criteria being sent
      console.log('Ranking criteria:', criteria);
      
      const response = await cachedApiService.createRanking(jobId, resumeIds, criteria)
      console.log('API Response for createRanking:', response)
      if (response.ranking_id && response.ranking_id !== '') {
        toast.success('Ranking created successfully!')
        console.log('Redirecting to ranking page...')
        router.push(`/ranking?job=${jobId}`) // Redirect to the main ranking page for the job
      } else {
        toast.error('Failed to create ranking. Please check that all required information is provided and try again.')
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Ranking</h1>
            <p className="text-gray-600">
              Define criteria to rank candidates for <span className="font-semibold">{job.title}</span>
            </p>
          </div>
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ranking Criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Weight Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="skills-weight">Skills Weight: {(criteria.skills_weight * 100).toFixed(0)}%</Label>
                <Slider
                  id="skills-weight"
                  min={0}
                  max={100}
                  step={1}
                  value={[criteria.skills_weight * 100]}
                  onValueChange={(val) => handleWeightChange('skills_weight', val)}
                  className="py-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience-weight">Experience Weight: {(criteria.experience_weight * 100).toFixed(0)}%</Label>
                <Slider
                  id="experience-weight"
                  min={0}
                  max={100}
                  step={1}
                  value={[criteria.experience_weight * 100]}
                  onValueChange={(val) => handleWeightChange('experience_weight', val)}
                  className="py-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="education-weight">Education Weight: {(criteria.education_weight * 100).toFixed(0)}%</Label>
                <Slider
                  id="education-weight"
                  min={0}
                  max={100}
                  step={1}
                  value={[criteria.education_weight * 100]}
                  onValueChange={(val) => handleWeightChange('education_weight', val)}
                  className="py-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keyword-weight">Keyword Weight: {(criteria.keyword_weight * 100).toFixed(0)}%</Label>
                <Slider
                  id="keyword-weight"
                  min={0}
                  max={100}
                  step={1}
                  value={[criteria.keyword_weight * 100]}
                  onValueChange={(val) => handleWeightChange('keyword_weight', val)}
                  className="py-2"
                />
              </div>
            </div>
            <div className="text-right text-sm text-gray-600">
              Total Weight: {totalWeightPercentage.toFixed(0)}% (auto-normalized)
            </div>

            {/* Require Degree */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="require-degree"
                checked={criteria.require_degree}
                onCheckedChange={(checked) => setCriteria(prev => ({ ...prev, require_degree: !!checked }))}
              />
              <Label htmlFor="require-degree">Require a degree for all candidates</Label>
            </div>

            {/* Required Skills */}
            <div>
              <Label htmlFor="required-skills">Required Skills</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="required-skills"
                  placeholder="Add a required skill"
                  value={newRequiredSkill}
                  onChange={(e) => setNewRequiredSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSkill('required', newRequiredSkill)
                    }
                  }}
                />
                <Button type="button" onClick={() => addSkill('required', newRequiredSkill)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {criteria.required_skills.map((skill, index) => (
                  <Badge key={index} variant="secondary" className="pr-1">
                    {skill}
                    <X className="ml-1 h-3 w-3 cursor-pointer" onClick={() => removeSkill('required', skill)} />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Preferred Skills */}
            <div>
              <Label htmlFor="preferred-skills">Preferred Skills</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="preferred-skills"
                  placeholder="Add a preferred skill"
                  value={newPreferredSkill}
                  onChange={(e) => setNewPreferredSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSkill('preferred', newPreferredSkill)
                    }
                  }}
                />
                <Button type="button" onClick={() => addSkill('preferred', newPreferredSkill)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {criteria.preferred_skills.map((skill, index) => (
                  <Badge key={index} variant="secondary" className="pr-1">
                    {skill}
                    <X className="ml-1 h-3 w-3 cursor-pointer" onClick={() => removeSkill('preferred', skill)} />
                  </Badge>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Award className="mr-2 h-4 w-4" />
              )}
              Create Ranking
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
