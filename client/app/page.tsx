'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExternalLink, Play, BarChart3, Target, FileText, Award, Briefcase, Users } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function HomePage() {
  // YouTube video section
  const youtubeVideoId = '-TRHvnnKGFY' // Placeholder - replace with actual video ID
  const youtubeUrl = `https://www.youtube.com/embed/${youtubeVideoId}`

  const features = [
    {
      title: "NLP-Driven Resume Analysis",
      description: "Intelligent parsing and extraction of candidate information using advanced NLP techniques",
      icon: FileText,
      color: "from-blue-500 to-blue-600"
    },
    {
      title: "ATS Scoring System",
      description: "Automated scoring of candidates against job requirements with detailed breakdowns",
      icon: Target,
      color: "from-green-500 to-green-600"
    },
    {
      title: "Candidate Ranking",
      description: "Multi-criteria ranking and shortlisting of candidates based on custom weights",
      icon: Award,
      color: "from-purple-500 to-purple-600"
    },
    {
      title: "Advanced Analytics",
      description: "Data-driven insights on hiring trends, skill gaps, and performance metrics",
      icon: BarChart3,
      color: "from-orange-500 to-orange-600"
    },
    {
      title: "Job Management",
      description: "Create and manage detailed job descriptions with requirements and scoring criteria",
      icon: Briefcase,
      color: "from-red-500 to-red-600"
    },
    {
      title: "Team Collaboration",
      description: "Share insights and collaborate with your hiring team for better decision making",
      icon: Users,
      color: "from-gray-500 to-gray-600"
    }
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 text-white rounded-xl p-6 md:p-8 mb-12">
        <div className="flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 mb-8 md:mb-0 md:pr-8">
            <div className="flex items-center mb-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-full p-2 mr-4">
                <Image
                  src="/favicon-32x32.png"
                  alt="RecruVizz Logo"
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold">RecruVizz</h1>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">NLP-Powered Hiring Platform</h2>
            <p className="text-lg md:text-xl text-blue-100 mb-6">
              Streamline your hiring process with NLP-Driven resume analysis, intelligent candidate matching, and data-driven insights.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-blue-50">
                <Link href="/dashboard">Get Started</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                <Link href="#features">Learn More</Link>
              </Button>
            </div>
          </div>
          <div className="md:w-1/2">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <Play className="h-5 w-5 mr-2" />
                  Product Demo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-blue-100 mb-4 text-sm">
                  Watch a quick walkthrough of RecruVizz in action.
                </p>
                
                {/* Responsive YouTube Embed */}
                <div className="relative pb-[56.25%] h-0 rounded-lg overflow-hidden"> {/* 16:9 Aspect Ratio */}
                  <iframe
                    src={youtubeUrl}
                    title="RecruVizz Product Demo"
                    className="absolute top-0 left-0 w-full h-full rounded-lg"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section id="features" className="mb-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-4">Powerful Features for Modern Hiring</h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          RecruVizz combines cutting-edge NLP technology with intuitive design to transform your hiring workflow.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="bg-white border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className={`w-12 h-12 mb-4 rounded-lg bg-gradient-to-r ${feature.color} flex items-center justify-center text-white`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Call to Action */}
      <section className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-8 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Ready to Transform Your Hiring Process?</h2>
        <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
          Join thousands of recruiters who are already using RecruVizz to find the perfect candidates faster and more efficiently.
        </p>
        <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
          <Link href="/dashboard">Start Free Trial</Link>
        </Button>
        <p className="text-sm text-gray-500 mt-4">No credit card required • 14-day free trial</p>
      </section>
    </div>
  )
}