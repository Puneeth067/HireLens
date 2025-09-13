import { Upload, FileText, BarChart3, Zap } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-16">
      {/* Hero Section */}
      <div className="text-center mb-20">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-6 bg-gradient-to-r from-primary to-blue-600 bg-clip-text animate-gradient-x">
          AI-Powered Resume Parser
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto">
          Streamline your recruitment process with intelligent resume parsing, skill analysis, and ATS scoring. Upload resumes individually or in bulk.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/upload"
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-300"
          >
            Start Parsing Resumes
          </Link>
          <Link
            href="/compare"
            className="border border-primary text-primary hover:bg-primary hover:text-primary-foreground px-8 py-3 rounded-xl font-semibold transition-all duration-300"
          >
            Compare with Job Description
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
        {[
          { icon: Upload, title: "Easy Upload", desc: "Drag & drop PDF or DOCX files. Process individually or in bulk." },
          { icon: FileText, title: "Smart Parsing", desc: "Extract contact info, experience, education, and skills automatically." },
          { icon: BarChart3, title: "ATS Scoring", desc: "Compare resumes against job descriptions with detailed scoring." },
          { icon: Zap, title: "Instant Results", desc: "Get detailed insights and recommendations in seconds." },
        ].map((feature, i) => {
          const Icon = feature.icon;
          return (
            <div
              key={i}
              className="group text-center p-6 rounded-2xl border border-border bg-card shadow-sm hover:shadow-lg transition-shadow duration-300 cursor-pointer"
            >
              <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transform transition-all duration-300">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          );
        })}
      </div>

      {/* How It Works */}
      <div className="bg-muted/50 dark:bg-muted/30 rounded-3xl p-10 mb-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {[{
            step: 1,
            title: "Upload Resumes",
            desc: "Upload single or multiple PDF/DOCX resume files through our intuitive interface."
          },{
            step: 2,
            title: "AI Analysis",
            desc: "Our AI extracts and structures data: contact info, skills, experience, and education."
          },{
            step: 3,
            title: "Get Insights",
            desc: "Compare against job descriptions, get ATS scores, and actionable recommendations."
          }].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 text-primary-foreground font-bold text-xl shadow-md group hover:scale-110 transition-transform duration-300">
                {item.step}
              </div>
              <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
              <p className="text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Section */}
      <div className="text-center mb-20">
        <h2 className="text-3xl md:text-4xl font-bold mb-10">Trusted by Recruiters Worldwide</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            { value: "10,000+", label: "Resumes Parsed" },
            { value: "95%", label: "Accuracy Rate" },
            { value: "2x", label: "Faster Screening" },
          ].map((stat, i) => (
            <div key={i} className="bg-card rounded-2xl p-6 shadow hover:shadow-lg transition-shadow duration-300">
              <div className="text-5xl md:text-6xl font-extrabold text-primary mb-2 animate-pulse">{stat.value}</div>
              <div className="text-muted-foreground font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
