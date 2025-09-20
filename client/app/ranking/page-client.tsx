'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cachedApiService } from '@/lib/cached-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Users, TrendingUp, Award, Plus, ArrowLeft, CheckCircle, BarChart3 } from 'lucide-react'
import { 
  JobDescriptionResponse, 
  RankingListResponse, 
  RankingStatisticsResponse,
  CandidateRanking,
  RankedCandidate,
  RankingCriteria
} from '@/lib/types'
import { FormSkeleton } from '@/components/ui/skeleton'

export default function RankingPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<JobDescriptionResponse[]>([])
  const [selectedJob, setSelectedJob] = useState<string>('')
  const [rankings, setRankings] = useState<CandidateRanking[]>([])
  const [currentRanking, setCurrentRanking] = useState<CandidateRanking | null>(null)
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRequirements, setFilterRequirements] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('rank')
  const [loading, setLoading] = useState(false)
  const [statistics, setStatistics] = useState({
    total_rankings: 0,
    total_candidates: 0,
    average_score: 0,
    top_score: 0,
    candidates_meeting_requirements: 0
  })

  
  const fetchJobs = async () => {
    try {
      const data = await cachedApiService.getJobs({ status: 'active' })
      setJobs(data.jobs || [])
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [])

  // Effect to handle job selection from query parameters
  useEffect(() => {
    const jobId = searchParams.get('job');
    if (jobId && !selectedJob) {
      setSelectedJob(jobId);
    }
  }, [searchParams, selectedJob]);
  
  const fetchRankings = useCallback(async () => {
    if (!selectedJob) return
    
    setLoading(true)
    try {
      const response: RankingListResponse = await cachedApiService.getRankingsByJob(selectedJob)
      setRankings(response.rankings || [])
      if (response.rankings && response.rankings.length > 0) {
        setCurrentRanking(response.rankings[0]) // Most recent ranking
      } else {
        // If no rankings exist, fetch raw candidates for the job
        const candidatesResponse = await cachedApiService.getCandidatesForJob(selectedJob)
        if (candidatesResponse.success && candidatesResponse.candidates.length > 0) {
          // Create a temporary ranking display with raw candidates
          const tempRanking: CandidateRanking = {
            id: 'temp',
            job_id: selectedJob,
            criteria: {
              skills_weight: 0.4,
              experience_weight: 0.3,
              education_weight: 0.2,
              keyword_weight: 0.1,
              require_degree: false,
              required_skills: [],
              preferred_skills: []
            },
            candidates: candidatesResponse.candidates.map((candidate, index) => ({
              ...candidate,
              rank: index + 1
            })),
            total_candidates: candidatesResponse.candidates.length,
            created_at: new Date().toISOString(),
            average_score: 0,
            median_score: 0,
            top_score: 0,
            candidates_meeting_requirements: 0
          }
          setCurrentRanking(tempRanking)
        }
      }
    } catch (error) {
      console.error('Failed to fetch rankings:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedJob])

  const fetchStatistics = useCallback(async () => {
    if (!selectedJob) return
    
    try {
      const response: RankingStatisticsResponse = await cachedApiService.getRankingStatistics(selectedJob)
      setStatistics(response.statistics || {
        total_rankings: 0,
        total_candidates: 0,
        average_score: 0,
        top_score: 0,
        candidates_meeting_requirements: 0
      })
    } catch (error) {
      console.error('Failed to fetch statistics:', error)
    }
  }, [selectedJob])

  useEffect(() => {
    if (selectedJob) {
      fetchRankings()
      fetchStatistics()
    }
  }, [selectedJob, fetchRankings, fetchStatistics])

  const generateShortlist = async () => {
    if (!selectedJob) return
    
    setLoading(true)
    try {
      const response = await cachedApiService.getShortlistSuggestions(selectedJob, 10)
      if (response.success) {
        // Create a temporary ranking display for shortlist
        const shortlistRanking: CandidateRanking = {
          id: 'shortlist',
          job_id: selectedJob,
          criteria: {
            skills_weight: 0.4,
            experience_weight: 0.3,
            education_weight: 0.2,
            keyword_weight: 0.1,
            require_degree: false,
            required_skills: [],
            preferred_skills: []
          },
          candidates: response.suggestions || [],
          total_candidates: response.suggestions?.length || 0,
          created_at: new Date().toISOString(),
          average_score: 0,
          median_score: 0,
          top_score: 0,
          candidates_meeting_requirements: 0
        }
        setCurrentRanking(shortlistRanking)
      }
    } catch (error) {
      console.error('Failed to generate shortlist:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleCandidateSelection = (candidateId: string) => {
    const newSelection = new Set(selectedCandidates)
    if (newSelection.has(candidateId)) {
      newSelection.delete(candidateId)
    } else {
      newSelection.add(candidateId)
    }
    setSelectedCandidates(newSelection)
  }

  const filteredAndSortedCandidates = () => {
    if (!currentRanking) return []
    
    const filtered = currentRanking.candidates.filter(candidate => {
      const matchesSearch = (candidate.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           candidate.resume_filename.toLowerCase().includes(searchTerm.toLowerCase())) ?? false
      
      const matchesRequirements = filterRequirements === 'all' ||
                                 (filterRequirements === 'meets' && candidate.meets_requirements) ||
                                 (filterRequirements === 'doesnt_meet' && !candidate.meets_requirements)
      
      return matchesSearch && matchesRequirements
    })

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rank':
          return a.rank - b.rank
        case 'name':
          return (a.candidate_name || '').localeCompare(b.candidate_name || '')
        case 'score':
          return (b.composite_score || 0) - (a.composite_score || 0)
        default:
          return a.rank - b.rank
      }
    })

    return filtered
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-blue-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-blue-500'
    if (score >= 40) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getRequirementBadge = (meets: boolean) => {
    return meets ? (
      <Badge variant="default" className="bg-green-100 text-green-800">
        Meets Requirements
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-red-100 text-red-800">
        Doesn&apos;t Meet
      </Badge>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Candidate Ranking</h1>
            <p className="text-gray-600">
              Analyze and rank candidates based on job requirements and qualifications
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

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a job position" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.title} at {job.company}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedJob && (
          <Button 
            onClick={() => router.push(`/ranking/create?job=${selectedJob}`)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create New Ranking
          </Button>
        )}
      </div>

      {selectedJob && (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Candidates</p>
                    <p className="text-2xl font-bold text-gray-900">{statistics.total_candidates}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Average Score</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {typeof statistics.average_score === 'number' ? statistics.average_score.toFixed(1) : '0.0'}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Award className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Top Score</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {typeof statistics.top_score === 'number' ? statistics.top_score.toFixed(1) : '0.0'}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Meet Requirements</p>
                    <p className="text-2xl font-bold text-gray-900">{statistics.candidates_meeting_requirements}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Rankings</p>
                    <p className="text-2xl font-bold text-gray-900">{statistics.total_rankings}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="current" className="w-full">
            <TabsList className="inline-flex h-12 items-center justify-center rounded-lg bg-gray-100 p-1.5 text-muted-foreground mb-6">
              <TabsTrigger 
                value="current" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-gray-200"
              >
                Current Ranking
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-gray-200"
              >
                Ranking History
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="current" className="mt-0">
              {loading ? (
                <Card className="border border-gray-200 shadow-sm">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading ranking data...</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : currentRanking ? (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Ranking Criteria</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Skills Weight</p>
                          <p className="font-medium">{(currentRanking.criteria.skills_weight * 100).toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Experience Weight</p>
                          <p className="font-medium">{(currentRanking.criteria.experience_weight * 100).toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Education Weight</p>
                          <p className="font-medium">{(currentRanking.criteria.education_weight * 100).toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Keyword Weight</p>
                          <p className="font-medium">{(currentRanking.criteria.keyword_weight * 100).toFixed(0)}%</p>
                        </div>
                      </div>
                      {currentRanking.criteria.required_skills.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-600 mb-2">Required Skills</p>
                          <div className="flex flex-wrap gap-2">
                            {currentRanking.criteria.required_skills.map((skill, index) => (
                              <Badge key={index} variant="default">{skill}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {currentRanking.criteria.preferred_skills.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-600 mb-2">Preferred Skills</p>
                          <div className="flex flex-wrap gap-2">
                            {currentRanking.criteria.preferred_skills.map((skill, index) => (
                              <Badge key={index} variant="secondary">{skill}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <CardTitle>Candidate Rankings</CardTitle>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              placeholder="Search candidates..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-10 w-full sm:w-64"
                            />
                          </div>
                          <Select value={filterRequirements} onValueChange={setFilterRequirements}>
                            <SelectTrigger className="w-full sm:w-48">
                              <SelectValue placeholder="Filter by requirements" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Candidates</SelectItem>
                              <SelectItem value="meets">Meet Requirements</SelectItem>
                              <SelectItem value="doesnt_meet">Don&apos;t Meet Requirements</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-full sm:w-32">
                              <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rank">Rank</SelectItem>
                              <SelectItem value="name">Name</SelectItem>
                              <SelectItem value="score">Score</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-3 px-4 font-medium text-gray-600">Rank</th>
                              <th className="text-left py-3 px-4 font-medium text-gray-600">Candidate</th>
                              <th className="text-left py-3 px-4 font-medium text-gray-600">Requirements</th>
                              <th className="text-left py-3 px-4 font-medium text-gray-600">Score</th>
                              <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAndSortedCandidates().map((candidate) => (
                              <tr key={candidate.resume_id} className="border-b hover:bg-gray-50">
                                <td className="py-3 px-4 font-medium">#{candidate.rank}</td>
                                <td className="py-3 px-4">
                                  <div>
                                    <p className="font-medium">{candidate.candidate_name || 'Unknown'}</p>
                                    <p className="text-sm text-gray-600">{candidate.resume_filename}</p>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  {getRequirementBadge(candidate.meets_requirements)}
                                </td>
                                <td className="py-3 px-4">
                                  <Badge className={`${getScoreBadgeColor(candidate.composite_score)} text-white`}>
                                    {typeof candidate.composite_score === 'number' ? candidate.composite_score.toFixed(1) : 'N/A'}%
                                  </Badge>
                                </td>
                                <td className="py-3 px-4">
                                  <Button variant="outline" size="sm">
                                    View Details
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {filteredAndSortedCandidates().length === 0 && (
                        <div className="text-center py-12">
                          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No candidates found</h3>
                          <p className="text-gray-500">
                            Try adjusting your search or filter criteria.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="border border-gray-200 shadow-sm">
                  <CardContent className="pt-6 text-center py-12">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No ranking data available</h3>
                    <p className="text-gray-500 mb-4">
                      Create a new ranking for this job position to get started.
                    </p>
                    <Button onClick={() => router.push(`/ranking/create?job=${selectedJob}`)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Ranking
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="history" className="mt-0">
              {rankings.length > 0 ? (
                <div className="space-y-4">
                  {rankings.map((ranking) => (
                    <Card key={ranking.id} className="border border-gray-200 shadow-sm">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>
                            Ranking from {new Date(ranking.created_at).toLocaleDateString()}
                          </CardTitle>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Total Candidates</p>
                            <p className="font-medium">{ranking.total_candidates}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Average Score</p>
                            <p className="font-medium">
                              {typeof ranking.average_score === 'number' ? ranking.average_score.toFixed(1) : '0.0'}%
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Top Score</p>
                            <p className="font-medium">
                              {typeof ranking.top_score === 'number' ? ranking.top_score.toFixed(1) : '0.0'}%
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Meet Requirements</p>
                            <p className="font-medium">{ranking.candidates_meeting_requirements}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border border-gray-200 shadow-sm">
                  <CardContent className="pt-6 text-center py-12">
                    <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No ranking history</h3>
                    <p className="text-gray-500">
                      Rankings you create will appear here for future reference.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {!selectedJob && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="pt-6 text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a job position</h3>
            <p className="text-gray-500">
              Choose a job position from the dropdown above to view and create candidate rankings.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}