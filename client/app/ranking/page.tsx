'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { cachedApiService } from '@/lib/cached-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Users, TrendingUp, Award, Plus, ArrowLeft } from 'lucide-react'
import { 
  JobDescriptionResponse, 
  RankingListResponse, 
  RankingStatisticsResponse,
  CandidateRanking,
  RankedCandidate,
  RankingCriteria
} from '@/lib/types'

export default function RankingPage() {
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
        case 'score_desc':
          return b.composite_score - a.composite_score
        case 'score_asc':
          return a.composite_score - b.composite_score
        case 'name':
          return (a.candidate_name || '').localeCompare(b.candidate_name || '')
        default:
          return a.rank - b.rank
      }
    })

    return filtered
  }

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 bg-green-50'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getScoreBadgeColor = (score: number): string => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Candidate Ranking</h1>
            <p className="text-gray-600">
              Rank and compare candidates using advanced scoring algorithms
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

      {/* Job Selection */}
      <Card className="mb-6 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select Job Position
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <Select value={selectedJob} onValueChange={setSelectedJob}>
              <SelectTrigger className="flex-1 bg-white">
                <SelectValue placeholder="Choose a job position to rank candidates" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {jobs.map(job => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title} at {job.company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedJob && (
              <div className="flex gap-2">
                <Link href={`/ranking/create?job=${selectedJob}`}>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    New Ranking
                  </Button>
                </Link>
                <Button onClick={generateShortlist} disabled={loading}>
                  <Award className="h-4 w-4 mr-2" />
                  AI Shortlist
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedJob && (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white">
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Rankings</p>
                    <p className="text-2xl font-bold text-gray-900">{statistics.total_rankings}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Candidates</p>
                    <p className="text-2xl font-bold text-gray-900">{statistics.total_candidates}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <Award className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Average Score</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {statistics.average_score?.toFixed(1) || '0.0'}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Meeting Requirements</p>
                    <p className="text-2xl font-bold text-gray-900">{statistics.candidates_meeting_requirements}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="ranking" className="space-y-4">
            <TabsList>
              <TabsTrigger value="ranking">Current Ranking</TabsTrigger>
              {selectedCandidates.size > 0 && (
                <TabsTrigger value="compare">Compare Candidates</TabsTrigger>
              )}
              <TabsTrigger value="history">Ranking History</TabsTrigger>
            </TabsList>

            <TabsContent value="ranking" className="space-y-4">
              {currentRanking && (
                <>
                  {/* Search and Filters */}
                  <Card className="bg-white">
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                              placeholder="Search candidates..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-10 bg-white"
                            />
                          </div>
                        </div>
                        
                        <Select value={filterRequirements} onValueChange={setFilterRequirements}>
                          <SelectTrigger className="w-48 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="all">All Candidates</SelectItem>
                            <SelectItem value="meets">Meets Requirements</SelectItem>
                            <SelectItem value="doesnt_meet">Doesn&apos;t Meet Requirements</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger className="w-48 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="rank">Sort by Rank</SelectItem>
                            <SelectItem value="score_desc">Score (High to Low)</SelectItem>
                            <SelectItem value="score_asc">Score (Low to High)</SelectItem>
                            <SelectItem value="name">Name (A-Z)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Candidates List */}
                  <div className="space-y-4">
                    {filteredAndSortedCandidates().map(candidate => (
                      <Card 
                        key={candidate.resume_id}
                        className={`transition-all duration-200 hover:shadow-md cursor-pointer bg-white ${
                          selectedCandidates.has(candidate.resume_id) ? 'ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => toggleCandidateSelection(candidate.resume_id)}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-4 flex-1">
                              <div className="flex-shrink-0">
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
                                  <span className="text-lg font-bold text-blue-800">
                                    #{candidate.rank}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                                    {candidate.candidate_name || 'Unknown Candidate'}
                                  </h3>
                                  <div className="flex items-center space-x-2">
                                    <Badge 
                                      className={`${getScoreBadgeColor(candidate.composite_score)} text-white`}
                                    >
                                      {candidate.composite_score.toFixed(1)}%
                                    </Badge>
                                    {candidate.meets_requirements ? (
                                      <Badge variant="outline" className="text-green-600 border-green-600">
                                        ✓ Qualified
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-gray-500 border-gray-500">
                                        Needs Review
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                
                                <p className="text-sm text-gray-500 mb-3">{candidate.resume_filename}</p>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  <div>
                                    <p className="text-xs text-gray-500">Skills</p>
                                    <p className={`text-sm font-medium px-2 py-1 rounded ${getScoreColor(candidate.skills_score)}`}>
                                      {candidate.skills_score.toFixed(1)}%
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Experience</p>
                                    <p className={`text-sm font-medium px-2 py-1 rounded ${getScoreColor(candidate.experience_score)}`}>
                                      {candidate.experience_score.toFixed(1)}%
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Education</p>
                                    <p className={`text-sm font-medium px-2 py-1 rounded ${getScoreColor(candidate.education_score)}`}>
                                      {candidate.education_score.toFixed(1)}%
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Keywords</p>
                                    <p className={`text-sm font-medium px-2 py-1 rounded ${getScoreColor(candidate.keyword_score)}`}>
                                      {candidate.keyword_score.toFixed(1)}%
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {filteredAndSortedCandidates().length === 0 && (
                    <Card className="bg-white">
                      <CardContent className="pt-6 text-center py-12">
                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No candidates found</h3>
                        <p className="text-gray-500">
                          Try adjusting your search terms or filters to find candidates.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {!currentRanking && !loading && (
                <Card className="bg-white">
                  <CardContent className="pt-6 text-center py-12">
                    <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No ranking available</h3>
                    <p className="text-gray-500 mb-6">
                      Create a new ranking or generate an AI shortlist to get started. 
                      Make sure you have uploaded resumes and associated them with this job.
                    </p>
                    <div className="flex justify-center gap-4">
                      <Link href={`/ranking/create?job=${selectedJob}`}>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Ranking
                        </Button>
                      </Link>
                      <Button variant="outline" onClick={generateShortlist}>
                        <Award className="h-4 w-4 mr-2" />
                        Generate Shortlist
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {selectedCandidates.size > 0 && (
              <TabsContent value="compare" className="space-y-4">
                {selectedCandidates.size > 1 ? (
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle>
                        Compare Selected Candidates ({selectedCandidates.size})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <p className="text-gray-600">
                          Compare the selected candidates side by side to make informed decisions.
                        </p>
                        <Link href={`/ranking/compare?job=${selectedJob}&candidates=${Array.from(selectedCandidates).join(',')}`}>
                          <Button>
                            Compare Now
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-white">
                    <CardContent className="pt-6 text-center py-12">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Select more candidates to compare</h3>
                      <p className="text-gray-500 mb-4">
                        You need at least 2 candidates to perform a comparison.
                      </p>
                      <p className="text-gray-500">
                        Click on candidate cards in the ranking tab to select more candidates for comparison.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            )}

            <TabsContent value="history" className="space-y-4">
              {rankings.length > 0 ? (
                <div className="space-y-4">
                  {rankings.map(ranking => (
                    <Card key={ranking.id} className="bg-white">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">
                              Ranking from {new Date(ranking.created_at).toLocaleDateString()}
                            </h3>
                            <p className="text-gray-500">
                              {ranking.total_candidates} candidates • 
                              Average score: {ranking.average_score?.toFixed(1)}% •
                              {ranking.candidates_meeting_requirements} meeting requirements
                            </p>
                          </div>
                          <Button 
                            variant="outline" 
                            onClick={() => setCurrentRanking(ranking)}
                          >
                            View Ranking
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-white">
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
        <Card className="bg-white">
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