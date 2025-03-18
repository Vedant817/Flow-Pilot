"use client";
import { useRouter } from "next/navigation";
import {
  BarChart2,
  PieChart,
  ArrowRight,
  Play,
  Database,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();

  const navigateTo = (path: string) => {
    router.push(path);
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Navigation */}
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 z-50 bg-black">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-lg bg-[#00E676] flex items-center justify-center text-black font-bold text-sm">
            AO
          </div>
          <div className="ml-3">
            <h2 className="text-white font-bold">Automated Order</h2>
            <p className="text-gray-400 text-sm">Processing System</p>
          </div>
        </div>

        <div className="hidden md:flex items-center space-x-8">
          <a href="#features" className="text-gray-300 hover:text-white">
            Features
          </a>
          <a href="#pricing" className="text-gray-300 hover:text-white">
            Pricing
          </a>
          <a href="#testimonials" className="text-gray-300 hover:text-white">
            Testimonials
          </a>
          <a href="#faq" className="text-gray-300 hover:text-white">
            FAQ
          </a>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigateTo("/sign-in")}
            className="text-white hover:text-[#00E676]"
          >
            Sign In
          </button>
          <button
            onClick={() => navigateTo("/sign-up")}
            className="bg-[#00E676] text-black px-4 py-2 rounded-md font-medium hover:bg-opacity-90"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 opacity-10 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#00E676] rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#00E676] rounded-full filter blur-3xl"></div>
        </div>

        <div className="container mx-auto px-6 py-16 md:py-24 relative z-10">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-12 md:mb-0">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Automated Order Processing System
              </h1>
              <p className="text-xl text-gray-400 mb-8 max-w-lg">
                Track, manage, and optimize your orders with our
                powerful dashboard. Get real-time insights and never run out of
                stock again.
              </p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={() => navigateTo("/sign-up")}
                  className="bg-[#00E676] text-black px-6 py-3 rounded-md font-medium hover:bg-opacity-90 flex items-center justify-center"
                >
                  Get Started <ArrowRight size={18} className="ml-2" />
                </button>
                <button className="border border-gray-700 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-900 flex items-center justify-center">
                  <Play size={18} className="mr-2" /> Watch Demo
                </button>
              </div>
            </div>

            <div className="md:w-1/2">
              <div className="bg-gray-900 rounded-lg p-4 shadow-2xl border border-gray-800 transform rotate-1 hover:rotate-0 transition-transform duration-300">
                <div className="rounded-md shadow-lg overflow-hidden">
                  <div className="bg-[#111827] p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-white text-lg font-bold">
                        Inventory Dashboard
                      </h3>
                      <div className="flex space-x-2">
                        <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                        <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                        <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div className="bg-black p-3 rounded-md">
                        <p className="text-gray-400 text-xs">Total Products</p>
                        <p className="text-white text-xl font-bold">5</p>
                      </div>
                      <div className="bg-black p-3 rounded-md">
                        <p className="text-gray-400 text-xs">Low Stock</p>
                        <p className="text-red-500 text-xl font-bold">1</p>
                      </div>
                      <div className="bg-black p-3 rounded-md">
                        <p className="text-gray-400 text-xs">Total Value</p>
                        <p className="text-[#00E676] text-xl font-bold">
                          $109,095
                        </p>
                      </div>
                      <div className="bg-black p-3 rounded-md">
                        <p className="text-gray-400 text-xs">Categories</p>
                        <p className="text-white text-xl font-bold">4</p>
                      </div>
                    </div>
                    <div className="bg-black rounded-md p-2">
                      <div className="grid grid-cols-7 gap-2 text-gray-400 text-xs p-2">
                        <div>ID</div>
                        <div>Name</div>
                        <div>Category</div>
                        <div>Price</div>
                        <div>Qty</div>
                        <div>Supplier</div>
                        <div>Actions</div>
                      </div>
                      <div className="grid grid-cols-7 gap-2 text-white text-sm p-2 border-t border-gray-800">
                        <div>PROD001</div>
                        <div>Premium Laptop</div>
                        <div>Electronics</div>
                        <div>$1299.99</div>
                        <div className="text-green-500">50</div>
                        <div>TechCorp</div>
                        <div className="flex space-x-1">
                          <span className="w-6 h-6 bg-[#00E676] rounded-full flex items-center justify-center text-black">
                            ✓
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

      {/* Stats Section */}
      <section className="bg-gray-900 py-12">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-[#00E676] text-4xl font-bold mb-2">500+</p>
              <p className="text-gray-400">Electronics Retailers Trust Us</p>
            </div>
            <div>
              <p className="text-[#00E676] text-4xl font-bold mb-2">99.9%</p>
              <p className="text-gray-400">Uptime Guaranteed</p>
            </div>
            <div>
              <p className="text-[#00E676] text-4xl font-bold mb-2">$10M+</p>
              <p className="text-gray-400">Inventory Managed Daily</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powerful Features
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Our inventory management system is packed with features designed
              to help electronics retailers optimize their operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
              <div className="w-12 h-12 bg-green-900 rounded-lg flex items-center justify-center mb-4">
                <BarChart2 className="text-[#00E676]" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Real-time Tracking</h3>
              <p className="text-gray-400">
                Monitor stock levels and get alerts when inventory runs low.
                Never miss a sales opportunity again.
              </p>
            </div>

            <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
              <div className="w-12 h-12 bg-green-900 rounded-lg flex items-center justify-center mb-4">
                <Database className="text-[#00E676]" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Centralized Management</h3>
              <p className="text-gray-400">
                Manage all your electronics inventory from a single dashboard
                with powerful filtering and search.
              </p>
            </div>

            <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
              <div className="w-12 h-12 bg-green-900 rounded-lg flex items-center justify-center mb-4">
                <PieChart className="text-[#00E676]" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Smart Analytics</h3>
              <p className="text-gray-400">
                Gain insights with powerful reporting and forecasting tools to
                make data-driven decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="py-16 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powerful Dashboard
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Everything you need to manage your inventory efficiently in one
              place.
            </p>
          </div>

          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 shadow-xl max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-black p-4 rounded-lg">
                <h3 className="text-gray-400 text-sm mb-1">Total Products</h3>
                <p className="text-white text-2xl font-bold">5</p>
              </div>
              <div className="bg-black p-4 rounded-lg">
                <h3 className="text-gray-400 text-sm mb-1">Low Stock Items</h3>
                <p className="text-red-500 text-2xl font-bold">1</p>
              </div>
              <div className="bg-black p-4 rounded-lg">
                <h3 className="text-gray-400 text-sm mb-1">Total Value</h3>
                <p className="text-[#00E676] text-2xl font-bold">$109,095.87</p>
              </div>
              <div className="bg-black p-4 rounded-lg">
                <h3 className="text-gray-400 text-sm mb-1">Categories</h3>
                <p className="text-white text-2xl font-bold">4</p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mb-4">
              <button className="bg-[#00E676] text-black px-4 py-2 rounded-md flex items-center">
                <span className="mr-1">+</span> Add Product
              </button>
              <button className="bg-gray-800 text-white px-4 py-2 rounded-md">
                Forecasting
              </button>
              <button className="bg-gray-800 text-white px-4 py-2 rounded-md">
                Price Adjustment
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full bg-black rounded-lg">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="py-3 px-4 text-left text-gray-400">
                      Product ID
                    </th>
                    <th className="py-3 px-4 text-left text-gray-400">Name</th>
                    <th className="py-3 px-4 text-left text-gray-400">
                      Category
                    </th>
                    <th className="py-3 px-4 text-left text-gray-400">Price</th>
                    <th className="py-3 px-4 text-left text-gray-400">
                      Quantity
                    </th>
                    <th className="py-3 px-4 text-left text-gray-400">
                      Supplier
                    </th>
                    <th className="py-3 px-4 text-left text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-white">PROD001</td>
                    <td className="py-3 px-4 text-white">Premium Laptop</td>
                    <td className="py-3 px-4 text-white">Electronics</td>
                    <td className="py-3 px-4 text-white">$1299.99</td>
                    <td className="py-3 px-4 text-green-500">50</td>
                    <td className="py-3 px-4 text-white">TechCorp</td>
                    <td className="py-3 px-4">
                      <div className="flex space-x-2">
                        <button className="w-8 h-8 bg-[#00E676] rounded-full flex items-center justify-center text-black">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-white">PROD003</td>
                    <td className="py-3 px-4 text-white">Smart Watch</td>
                    <td className="py-3 px-4 text-white">Wearables</td>
                    <td className="py-3 px-4 text-white">$299.99</td>
                    <td className="py-3 px-4 text-red-500">8</td>
                    <td className="py-3 px-4 text-white">TechCorp</td>
                    <td className="py-3 px-4">
                      <div className="flex space-x-2">
                        <button className="w-8 h-8 bg-[#00E676] rounded-full flex items-center justify-center text-black">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-16 bg-black">
  <div className="container mx-auto px-6">
    <div className="text-center mb-16">
      <h2 className="text-3xl md:text-4xl font-bold mb-4">
        What Our Customers Say
      </h2>
      <p className="text-gray-400 max-w-2xl mx-auto">
        Don&apos;t just take our word for it. Here&apos;s what electronics retailers
        have to say about our automated order processing system.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
        <div className="flex text-[#00E676] mb-4">★★★★★</div>
        <p className="text-gray-300 mb-6">
          &quot;The automated order processing system has transformed our operations.
          We&apos;ve reduced stockouts by 75% and improved cash flow
          significantly.&quot;
        </p>
        <div className="flex items-center">
          {/* <Image
            src="https://randomuser.me/api/portraits/men/32.jpg" 
            alt="Alex Johnson" 
            className="w-10 h-10 rounded-full object-cover"
            width={40}
            height={40}
          /> */}
          <div className="ml-3">
            <p className="font-medium">Alex Johnson</p>
            <p className="text-gray-500 text-sm">TechWorld Electronics</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
        <div className="flex text-[#00E676] mb-4">★★★★★</div>
        <p className="text-gray-300 mb-6">
          &quot;The analytics features alone are worth the investment. We can
          now predict trends and stock accordingly. Game changer!&quot;
        </p>
        <div className="flex items-center">
          {/* <Image 
            src="https://randomuser.me/api/portraits/women/44.jpg" 
            alt="Sarah Williams" 
            className="w-10 h-10 rounded-full object-cover"
            height={40}
            width={40}
          /> */}
          <div className="ml-3">
            <p className="font-medium">Sarah Williams</p>
            <p className="text-gray-500 text-sm">Gadget Galaxy</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
        <div className="flex text-[#00E676] mb-4">★★★★★</div>
        <p className="text-gray-300 mb-6">
          &quot;Implementation was smooth and the customer support is
          exceptional. Our inventory accuracy has improved from 85% to
          99%.&quot;
        </p>
        <div className="flex items-center">
          {/* <Image 
            src="https://randomuser.me/api/portraits/men/75.jpg" 
            alt="Michael Chen" 
            className="w-10 h-10 rounded-full object-cover"
            height={40}
            width={40}
          /> */}
          <div className="ml-3">
            <p className="font-medium">Michael Chen</p>
            <p className="text-gray-500 text-sm">ElectroMart</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>


      {/* Pricing Section */}
      <section id="pricing" className="py-16 md:py-24 bg-gray-900">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Choose the plan that fits your business needs. All plans include
              our core features.
            </p>

            <div className="flex justify-center mt-6">
              <div className="bg-black p-1 rounded-full inline-flex">
                <button className="px-4 py-2 rounded-full bg-[#00E676] text-black">
                  Monthly
                </button>
                <button className="px-4 py-2 rounded-full text-gray-400">
                  Annual (Save 20%)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-black rounded-lg border border-gray-800 overflow-hidden">
              <div className="p-6">
                <h3 className="text-xl font-bold mb-4">Basic</h3>
                <p className="text-4xl font-bold mb-6">
                  $49<span className="text-gray-500 text-lg">/mo</span>
                </p>
                <p className="text-gray-400 mb-6">
                  Perfect for small electronics retailers
                </p>

                <ul className="space-y-3 mb-6">
                  <li className="flex items-center">
                    <span className="text-[#00E676] mr-2">✓</span>
                    <span>Up to 1,000 products</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#00E676] mr-2">✓</span>
                    <span>Basic analytics</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#00E676] mr-2">✓</span>
                    <span>Email support</span>
                  </li>
                </ul>

                <button className="w-full border border-[#00E676] text-[#00E676] py-2 rounded-md hover:bg-[#00E676] hover:text-black transition-colors">
                  Get Started
                </button>
              </div>
            </div>

            <div className="bg-black rounded-lg border border-[#00E676] overflow-hidden relative">
              <div className="absolute top-0 right-0 bg-[#00E676] text-black text-xs font-bold px-3 py-1">
                MOST POPULAR
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-4">Pro</h3>
                <p className="text-4xl font-bold mb-6">
                  $99<span className="text-gray-500 text-lg">/mo</span>
                </p>
                <p className="text-gray-400 mb-6">
                  Ideal for growing electronics businesses
                </p>

                <ul className="space-y-3 mb-6">
                  <li className="flex items-center">
                    <span className="text-[#00E676] mr-2">✓</span>
                    <span>Up to 10,000 products</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#00E676] mr-2">✓</span>
                    <span>Advanced analytics</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#00E676] mr-2">✓</span>
                    <span>Priority support</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#00E676] mr-2">✓</span>
                    <span>API access</span>
                  </li>
                </ul>

                <button className="w-full bg-[#00E676] text-black py-2 rounded-md font-medium hover:bg-opacity-90 transition-colors">
                  Get Started
                </button>
              </div>
            </div>

            <div className="bg-black rounded-lg border border-gray-800 overflow-hidden">
              <div className="p-6">
                <h3 className="text-xl font-bold mb-4">Enterprise</h3>
                <p className="text-4xl font-bold mb-6">
                  $249<span className="text-gray-500 text-lg">/mo</span>
                </p>
                <p className="text-gray-400 mb-6">
                  For large electronics retailers
                </p>

                <ul className="space-y-3 mb-6">
                  <li className="flex items-center">
                    <span className="text-[#00E676] mr-2">✓</span>
                    <span>Unlimited products</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#00E676] mr-2">✓</span>
                    <span>Custom analytics</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#00E676] mr-2">✓</span>
                    <span>24/7 dedicated support</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-[#00E676] mr-2">✓</span>
                    <span>Advanced integrations</span>
                  </li>
                </ul>

                <button className="w-full border border-[#00E676] text-[#00E676] py-2 rounded-md hover:bg-[#00E676] hover:text-black transition-colors">
                  Contact Sales
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 bg-black">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Find answers to common questions about our inventory management
              system.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="mb-6 border border-gray-800 rounded-lg overflow-hidden">
              <div className="bg-gray-900 p-4 flex justify-between items-center cursor-pointer">
                <h3 className="font-medium">
                  How secure is my inventory data?
                </h3>
                <span className="text-[#00E676]">+</span>
              </div>
              <div className="p-4 bg-black">
                <p className="text-gray-400">
                  Your data is encrypted both in transit and at rest. We use
                  industry-standard security protocols and regularly perform
                  security audits to ensure your information is protected.
                </p>
              </div>
            </div>

            <div className="mb-6 border border-gray-800 rounded-lg overflow-hidden">
              <div className="bg-gray-900 p-4 flex justify-between items-center cursor-pointer">
                <h3 className="font-medium">
                  Can I integrate with my existing POS system?
                </h3>
                <span className="text-[#00E676]">+</span>
              </div>
              <div className="p-4 bg-black">
                <p className="text-gray-400">
                  Yes, our system offers API integration with most popular POS
                  systems. Our Pro and Enterprise plans include dedicated
                  support for custom integrations.
                </p>
              </div>
            </div>

            <div className="mb-6 border border-gray-800 rounded-lg overflow-hidden">
              <div className="bg-gray-900 p-4 flex justify-between items-center cursor-pointer">
                <h3 className="font-medium">Do you offer mobile access?</h3>
                <span className="text-[#00E676]">+</span>
              </div>
              <div className="p-4 bg-black">
                <p className="text-gray-400">
                  Yes, our platform is fully responsive and works on all
                  devices. We also offer dedicated mobile apps for iOS and
                  Android for on-the-go inventory management.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-black to-gray-900">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Transform Your Order Processing?
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto mb-8">
            Join 500+ retailers already saving time and money with
            Automated Order Processing System.
          </p>
          <button
            onClick={() => navigateTo("/sign-up")}
            className="bg-[#00E676] text-black px-8 py-4 rounded-md font-bold text-lg hover:bg-opacity-90"
          >
            Start Free Trial
          </button>
          <p className="text-gray-500 mt-4">
            No credit card required. 14-day free trial.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12 border-t border-gray-800">
  <div className="container mx-auto px-6">
    <div className="flex flex-col items-center justify-center">
      <div className="flex space-x-6 mb-6">
        <a href="#features" className="text-gray-400 hover:text-white">
          Features
        </a>
        <a href="#pricing" className="text-gray-400 hover:text-white">
          Pricing
        </a>
        <a
          href="#testimonials"
          className="text-gray-400 hover:text-white"
        >
          Testimonials
        </a>
        <a href="#faq" className="text-gray-400 hover:text-white">
          FAQ
        </a>
      </div>
      <div className="text-center">
        <p className="text-gray-500 text-sm">
          © 2025 Automated Order Processing System. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</footer>

    </div>
  );
}
