"use client"
import { useRouter } from "next/navigation"
import { BarChart2, ArrowRight, Database, Shield, Users, CheckCircle, TrendingUp, Globe, Award, Clock, Target, Cpu, Layers, BookOpen, Settings, AlertTriangle, SendToBack } from "lucide-react"

export default function LandingPage() {
  const router = useRouter()

  const navigateTo = (path: string) => {
    router.push(path)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 text-slate-900 overflow-x-hidden">
      <nav className="flex items-center justify-between px-6 py-2 bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
            <SendToBack />
          </div>
          <div className="ml-4">
            <h2 className="text-slate-900 font-bold text-xl">Omni Order</h2>
          </div>
        </div>

        <div className="hidden md:flex items-center space-x-8">
          <a href="#problem" className="text-slate-700 hover:text-blue-600 font-medium transition-colors">
            Challenge
          </a>
          <a href="#solution" className="text-slate-700 hover:text-blue-600 font-medium transition-colors">
            Solution
          </a>
          <a href="#features" className="text-slate-700 hover:text-blue-600 font-medium transition-colors">
            Platform
          </a>
          <a href="#workflow" className="text-slate-700 hover:text-blue-600 font-medium transition-colors">
            How It Works
          </a>
        </div>

        <div className="flex items-center space-x-4">
          <button onClick={() => navigateTo("/sign-in")} className="text-slate-700 hover:text-blue-600 font-medium transition-colors">
            Sign In
          </button>
          <button
            onClick={() => navigateTo("/sign-up")}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
          >
            Start Now
          </button>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="container mx-auto px-6 py-6 md:py-12 relative z-10">
          <div className="flex flex-col lg:flex-row items-center">
            <div className="lg:w-1/2 mb-16 lg:mb-0">
              <div className="inline-flex items-center bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Award className="w-4 h-4 mr-2" />
                Trusted by Global Fortune 500 Companies
              </div>
              
              <h1 className="text-5xl md:text-6xl font-bold mb-8 leading-tight">
                Transform Your 
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  Supply Chain Operations
                </span>
              </h1>
              
              <p className="text-xl text-slate-600 mb-10 max-w-lg leading-relaxed">
                Eliminate operational bottlenecks with AI-powered order processing. 
                Reduce manual errors by 95%, cut processing time by 75%, and achieve 
                real-time visibility across your entire supply chain ecosystem.
              </p>
              
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-12">
                <button
                  onClick={() => navigateTo("/sign-up")}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center text-lg"
                >
                  Start Now <ArrowRight size={20} className="ml-2" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-8 text-sm text-slate-500">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                  SOC 2 Type II Certified
                </div>
                <div className="flex items-center">
                  <Shield className="w-5 h-5 text-blue-500 mr-2" />
                  Enterprise-Grade Security
                </div>
                <div className="flex items-center">
                  <Clock className="w-5 h-5 text-purple-500 mr-2" />
                  99.99% Uptime SLA
                </div>
                <div className="flex items-center">
                  <Globe className="w-5 h-5 text-indigo-500 mr-2" />
                  Global Multi-Region Deployment
                </div>
              </div>
            </div>

            <div className="lg:w-1/2">
              <div className="bg-white rounded-2xl p-8 shadow-2xl border border-slate-200/50 backdrop-blur-sm transform hover:scale-105 transition-transform duration-300">
                <div className="rounded-xl shadow-lg overflow-hidden">
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-white text-xl font-bold">Real-Time Operations Dashboard</h3>
                      <div className="flex space-x-2">
                        <span className="w-3 h-3 bg-red-400 rounded-full"></span>
                        <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                        <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-700 p-4 rounded-lg">
                        <p className="text-slate-400 text-xs mb-1">Orders Processed Today</p>
                        <p className="text-white text-2xl font-bold">847,293</p>
                        <p className="text-green-400 text-xs flex items-center mt-1">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          +23.4% vs yesterday
                        </p>
                      </div>
                      <div className="bg-slate-700 p-4 rounded-lg">
                        <p className="text-slate-400 text-xs mb-1">Processing Time Avg</p>
                        <p className="text-white text-2xl font-bold">2.3s</p>
                        <p className="text-green-400 text-xs flex items-center mt-1">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          -45% improvement
                        </p>
                      </div>
                      <div className="bg-slate-700 p-4 rounded-lg">
                        <p className="text-slate-400 text-xs mb-1">Accuracy Rate</p>
                        <p className="text-white text-2xl font-bold">99.97%</p>
                        <p className="text-blue-400 text-xs">Target: 99.5%</p>
                      </div>
                      <div className="bg-slate-700 p-4 rounded-lg">
                        <p className="text-slate-400 text-xs mb-1">Cost Savings</p>
                        <p className="text-white text-2xl font-bold">$2.8M</p>
                        <p className="text-green-400 text-xs">This quarter</p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-700 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <p className="text-slate-300 text-sm font-medium">Active Processing Streams</p>
                        <span className="text-green-400 text-xs bg-green-400/10 px-2 py-1 rounded">Live</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-300">Email Processing Pipeline</span>
                          <span className="text-green-400 flex items-center">
                            <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                            Active
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-300">AI Classification Engine</span>
                          <span className="text-blue-400 flex items-center">
                            <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                            Processing
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-300">ERP Integration Layer</span>
                          <span className="text-green-400 flex items-center">
                            <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                            Synced
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-16">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Powering Enterprise Operations Globally</h2>
            <p className="text-blue-100 text-lg">Real impact across industries and geographies</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
            <div>
              <p className="text-4xl md:text-5xl font-bold mb-2">$50B+</p>
              <p className="text-blue-100 text-lg">Orders Processed Annually</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-bold mb-2">2.4s</p>
              <p className="text-blue-100 text-lg">Average Processing Time</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-bold mb-2">99.97%</p>
              <p className="text-blue-100 text-lg">Accuracy Rate</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-bold mb-2">150+</p>
              <p className="text-blue-100 text-lg">Countries Deployed</p>
            </div>
          </div>
        </div>
      </section>

      <section id="problem" className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900">
              The Enterprise Order Management Challenge
            </h2>
            <p className="text-xl text-slate-600 max-w-4xl mx-auto leading-relaxed">
              Modern enterprises process millions of orders across multiple channels, systems, and formats. 
              Traditional manual processes create bottlenecks, errors, and missed opportunities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500 mr-3" />
                <h3 className="text-xl font-bold text-slate-900">Manual Processing Bottlenecks</h3>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Teams spend 60-80% of their time on manual data entry, order verification, 
                and system updates, leading to delays and human errors.
              </p>
            </div>

            <div className="bg-orange-50 border-l-4 border-orange-500 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <Target className="w-8 h-8 text-orange-500 mr-3" />
                <h3 className="text-xl font-bold text-slate-900">Fragmented Systems</h3>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Orders arrive through emails, portals, EDI, and APIs, requiring manual 
                routing and translation between incompatible systems.
              </p>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <TrendingUp className="w-8 h-8 text-yellow-600 mr-3" />
                <h3 className="text-xl font-bold text-slate-900">Lack of Real-Time Visibility</h3>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Without unified dashboards, enterprises lose visibility into order status, 
                performance metrics, and operational bottlenecks.
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl p-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">The Cost of Inefficiency</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <p className="text-3xl font-bold text-red-600 mb-2">40%</p>
                  <p className="text-slate-700">Increase in processing costs due to manual workflows</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-red-600 mb-2">25%</p>
                  <p className="text-slate-700">Revenue loss from delayed order fulfillment</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-red-600 mb-2">15%</p>
                  <p className="text-slate-700">Error rate in manual order processing</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="solution" className="py-16 bg-gradient-to-br from-slate-100 to-blue-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900">
              The Omni Order Solution
            </h2>
            <p className="text-xl text-slate-600 max-w-4xl mx-auto leading-relaxed">
              A comprehensive AI-powered platform that unifies, automates, and optimizes 
              your entire order management ecosystem from capture to fulfillment.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <h3 className="text-3xl font-bold mb-6 text-slate-900">Intelligent Order Capture & Classification</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-green-500 mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-900">Multi-Channel Integration</h4>
                    <p className="text-slate-600">Automatically capture orders from emails, EDI, APIs, web portals, and mobile apps</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-green-500 mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-900">AI-Powered Classification</h4>
                    <p className="text-slate-600">Machine learning algorithms automatically categorize and route orders based on content, priority, and business rules</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-green-500 mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-900">Real-Time Validation</h4>
                    <p className="text-slate-600">Instant verification against inventory, pricing, and customer data with automated exception handling</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-xl">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg p-6 text-white">
                <h4 className="text-lg font-bold mb-4">Order Processing Pipeline</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                    <span>Email Orders</span>
                    <span className="bg-green-400 text-green-900 px-2 py-1 rounded text-xs font-bold">1,247 today</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                    <span>EDI Integration</span>
                    <span className="bg-blue-400 text-blue-900 px-2 py-1 rounded text-xs font-bold">523 today</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                    <span>API Endpoints</span>
                    <span className="bg-purple-400 text-purple-900 px-2 py-1 rounded text-xs font-bold">892 today</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="bg-white rounded-2xl p-6 shadow-xl order-2 lg:order-1">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg p-6 text-white">
                <h4 className="text-lg font-bold mb-4">System Integration Hub</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <Database className="w-6 h-6 mx-auto mb-2" />
                    <span className="text-sm">ERP Systems</span>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <Layers className="w-6 h-6 mx-auto mb-2" />
                    <span className="text-sm">CRM Platforms</span>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <Settings className="w-6 h-6 mx-auto mb-2" />
                    <span className="text-sm">WMS Solutions</span>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <Globe className="w-6 h-6 mx-auto mb-2" />
                    <span className="text-sm">E-commerce</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h3 className="text-3xl font-bold mb-6 text-slate-900">Seamless Enterprise Integration</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-green-500 mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-900">Universal API Connectivity</h4>
                    <p className="text-slate-600">Connect with 500+ enterprise systems including SAP, Oracle, Salesforce, and custom applications</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-green-500 mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-900">Real-Time Data Synchronization</h4>
                    <p className="text-slate-600">Bi-directional sync ensures all systems maintain consistent, up-to-date information</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-green-500 mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-900">Legacy System Support</h4>
                    <p className="text-slate-600">Work with existing infrastructure without requiring expensive system replacements</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900">
              Enterprise-Grade Platform Capabilities
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              Built for scale, security, and performance. Our platform delivers the reliability 
              and features that enterprise operations demand.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-2xl border border-blue-100 hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                <Cpu className="text-white" size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900">AI-Powered Automation</h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                Advanced machine learning algorithms automatically process, validate, and route orders 
                with 99.97% accuracy, eliminating manual intervention.
              </p>
              <ul className="text-sm text-slate-600 space-y-2">
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />Natural language processing for email orders</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />Intelligent data extraction and validation</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />Predictive analytics for demand forecasting</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-2xl border border-green-100 hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                <Shield className="text-white" size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900">Enterprise Security & Compliance</h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                Bank-grade security with comprehensive compliance frameworks to protect 
                sensitive business data and meet regulatory requirements.
              </p>
              <ul className="text-sm text-slate-600 space-y-2">
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />SOC 2 Type II certification</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />End-to-end encryption (AES-256)</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />GDPR, HIPAA, PCI DSS compliance</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-8 rounded-2xl border border-purple-100 hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                <Globe className="text-white" size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900">Global Scale & Performance</h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                Multi-region deployment with auto-scaling infrastructure that handles 
                peak loads while maintaining sub-second response times.
              </p>
              <ul className="text-sm text-slate-600 space-y-2">
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />99.99% uptime SLA guarantee</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />Auto-scaling to 1M+ orders/minute</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />150+ global data centers</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-red-50 p-8 rounded-2xl border border-orange-100 hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                <BarChart2 className="text-white" size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900">Advanced Analytics & Insights</h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                Real-time dashboards and predictive analytics provide actionable insights 
                for strategic decision-making and operational optimization.
              </p>
              <ul className="text-sm text-slate-600 space-y-2">
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />Real-time performance monitoring</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />Custom KPI tracking and alerts</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />Predictive demand analytics</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-8 rounded-2xl border border-cyan-100 hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                <Database className="text-white" size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900">Universal Integration Hub</h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                Connect seamlessly with existing enterprise systems through pre-built 
                connectors and flexible API frameworks.
              </p>
              <ul className="text-sm text-slate-600 space-y-2">
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />500+ pre-built integrations</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />RESTful APIs and webhooks</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />Legacy system support</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-pink-50 to-rose-50 p-8 rounded-2xl border border-pink-100 hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                <Users className="text-white" size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900">Enterprise Support & Success</h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                Dedicated customer success teams and priority support channels ensure 
                seamless implementation and ongoing optimization.
              </p>
              <ul className="text-sm text-slate-600 space-y-2">
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />24/7 dedicated support team</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />Customer success manager</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />Implementation consulting</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="py-20 bg-gradient-to-br from-slate-100 to-blue-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900">
              How Omni Order Transforms Your Operations
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              From order capture to fulfillment - see how our platform streamlines 
              your entire order management workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 relative">
              <div className="absolute -top-4 left-6">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">1</div>
              </div>
              <div className="pt-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <BookOpen className="text-blue-600" size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900">Intelligent Capture</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Orders automatically captured from emails, EDI, APIs, and portals. 
                  AI extracts and validates all relevant data points.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 relative">
              <div className="absolute -top-4 left-6">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">2</div>
              </div>
              <div className="pt-6">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Cpu className="text-green-600" size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900">Smart Processing</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Machine learning algorithms classify, prioritize, and route orders 
                  based on business rules and historical patterns.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 relative">
              <div className="absolute -top-4 left-6">
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">3</div>
              </div>
              <div className="pt-6">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Settings className="text-purple-600" size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900">System Integration</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Seamless integration with ERP, CRM, and WMS systems ensures 
                  data consistency across all platforms.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 relative">
              <div className="absolute -top-4 left-6">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">4</div>
              </div>
              <div className="pt-6">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="text-indigo-600" size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900">Real-Time Tracking</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Complete visibility into order status, performance metrics, 
                  and operational insights through unified dashboards.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="benefits" className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900">
              Measurable Business Impact
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Enterprise customers consistently achieve significant improvements 
              in efficiency, accuracy, and cost reduction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl font-bold">75%</span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">Faster Processing Time</h3>
              <p className="text-slate-600">
                Reduce order processing time from hours to minutes with automated workflows 
                and intelligent routing.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl font-bold">95%</span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">Error Reduction</h3>
              <p className="text-slate-600">
                Eliminate manual data entry errors with AI-powered validation 
                and automated quality checks.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl font-bold">40%</span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">Cost Savings</h3>
              <p className="text-slate-600">
                Lower operational costs through automation, reduced headcount needs, 
                and improved efficiency.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl font-bold">24/7</span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">Continuous Operations</h3>
              <p className="text-slate-600">
                Process orders around the clock without human intervention, 
                ensuring global coverage and faster response times.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl font-bold">99.9%</span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">System Reliability</h3>
              <p className="text-slate-600">
                Enterprise-grade infrastructure ensures consistent performance 
                and minimal downtime for business-critical operations.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl font-bold">100%</span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">Visibility & Control</h3>
              <p className="text-slate-600">
                Complete transparency into order status, performance metrics, 
                and business intelligence across all operations.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 text-white py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-6 md:mb-0">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold mr-3">
                <SendToBack />
              </div>
              <div>
                <h3 className="font-bold text-lg">Omni Order</h3>
                <p className="text-slate-400 text-sm">Enterprise Solution</p>
              </div>
            </div>
            
            <div className="flex space-x-8 text-slate-400">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Security</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
          
          <div className="border-t border-slate-700 mt-8 pt-8 text-center text-slate-400">
            <p>&copy; 2025 Omni Order. All rights reserved. Built for enterprise excellence.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}