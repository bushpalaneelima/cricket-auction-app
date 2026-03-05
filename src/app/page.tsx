'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LandingPage() {
  const router = useRouter();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    eventType: '',
    participants: '',
    message: '',
  });
  const [formSubmitted, setFormSubmitted] = useState(false);

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    setFormSubmitted(true);
    
    setTimeout(() => {
      setFormData({
        name: '',
        email: '',
        organization: '',
        eventType: '',
        participants: '',
        message: '',
      });
      setFormSubmitted(false);
    }, 3000);
  };

  const scrollToContact = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  const faqs = [
    {
      question: "What is Game of Gambits?",
      answer: "Game of Gambits is a strategic decision simulation where participants manage limited budgets to build optimal teams through competitive auction. Perfect for business education, corporate team building, and competitive entertainment."
    },
    {
      question: "Who is this for?",
      answer: "• Academic: MBA programs, business schools, decision-making courses\n• Corporate: Team building events, strategic workshops, leadership training\n• Entertainment: Friends, colleagues, cricket enthusiast groups\n• Format: Play together in-person or connect remotely from anywhere globally"
    },
    {
      question: "How does it work?",
      answer: "Simple 4-step process:\n1. Create Simulation - Admin sets up the session\n2. Select Participants - Choose your group (up to 12 teams per auction)\n3. Allocate Resources - Strategically invest your points to build your team\n4. Track Performance - Monitor results based on real match outcomes (with Score Management package)\n\nThis is a points-based simulation for learning and entertainment, not real money."
    },
    {
      question: "What makes this different from fantasy sports?",
      answer: "• Educational Focus: Teaches decision-making under resource constraints\n• Professional Grade: Built for training, simulations, and strategic exercises\n• Real-Time Strategy: Live allocation with time pressure and competition\n• Dual Purpose: Serious training tool AND competitive entertainment\n• Admin-Managed: Professional moderation of the entire event"
    },
    {
      question: "Is this gambling or betting?",
      answer: "No. This is a points-based simulation for education and entertainment. No real money is exchanged during the simulation itself. It's a strategic resource allocation exercise, similar to business case studies or board games."
    },
    {
      question: "What is the pricing?",
      answer: "For Entertainment (Friends/Colleagues):\n\nBasic Auction: ₹7,500 per auction\n• Auction simulation platform\n• Real-time resource allocation\n• Team management and reports\n• Split among participants (Example: 10 managers = ₹750 per person)\n\nComplete Package with Score Management: +₹5,000 per event\n• Everything in Basic, PLUS:\n• Track player performance in real matches\n• Live leaderboards throughout season\n• Performance analytics and statistics\n• Winner's trophy from NB Blue Studios (1st place)\n• Official winner recognition\n\nExample Pricing:\n• 2 auctions, 20 participants (Basic only): ₹15,000 total\n• 2 auctions, 20 participants (with Scoring): ₹20,000 total (includes 2 trophies)\n\nFor Academic & Corporate:\n• Custom pricing based on requirements\n• Institutional packages available\n• Contact: hello@nbbluestudios.com"
    },
    {
      question: "Can I use this for my organization?",
      answer: "Absolutely! We support:\n• Universities: Course modules, workshops, student competitions\n• Corporations: Team building events, training programs, leadership development\n• Training Firms: Client workshops and strategic simulations\n• Custom branding available for institutional clients\n• Professional admin manages the entire event for you"
    },
    {
      question: "How many people can participate?",
      answer: "Up to 12 managers can participate in a single auction. For larger groups, you can run multiple concurrent auctions within the same event. Each auction maintains its own competition and scoring."
    },
    {
      question: "What devices does it work on?",
      answer: "Any modern web browser - desktop, laptop, tablet, or mobile. No downloads or installations required. Works seamlessly across all devices with internet connection."
    },
    {
      question: "What does the winner get?",
      answer: "Winners of events with the Score Management Package receive:\n• 🏆 Physical trophy from NB Blue Studios (Champion - 1st place)\n• Official winner announcement on platform\n• Final leaderboard with complete rankings\n• Performance analytics and statistics\n• Digital certificate of achievement\n\nTrophy Delivery:\n• Hyderabad: Hand-delivered in person\n• Other locations: Shipped (handled case-by-case)\n\nNote: Each auction within an event has its own champion and trophy. For example, an event with 3 auctions awards 3 trophies (one per auction winner).\n\nTrophies are awarded only for events with Score Management package. Basic auction-only events do not include score tracking or trophies."
    },
    {
      question: "How do I get started?",
      answer: "Ready to run an auction simulation?\n\nContact us to discuss your event:\n• Email: hello@nbbluestudios.com\n• Website: www.nbbluestudios.com\n• Fill out the contact form with your requirements\n\nWe'll help you plan your event, determine group size, and provide pricing based on your specific needs. Our team will guide you through the setup process and ensure a smooth experience."
    },
    {
      question: "Can I customize the platform for my organization?",
      answer: "Yes! We offer customization options for institutional clients:\n• Custom Branding: Add your organization's logo and colors\n• Tailored Rules: Modify auction parameters to fit your requirements\n• Private Events: Exclusive sessions for your group\n• Custom Reports: Analytics formatted to your needs\n• White-label Options: Platform branded as your own tool (for enterprise clients)\n\nPerfect for universities, corporations, and training firms wanting a professional, branded experience.\n\nContact us at hello@nbbluestudios.com to discuss customization options."
    },
    {
      question: "How long does an auction take?",
      answer: "A typical auction session takes 1-2 hours depending on:\n• Number of participants (8-12 managers)\n• Number of players in the pool\n• Bidding pace and strategy\n\nThe platform is designed for engaging, real-time competition that fits within a single session - perfect for workshops, team building events, or evening entertainment."
    },
    {
      question: "Do I need cricket knowledge to participate?",
      answer: "Not necessarily! While the simulation uses cricket as its theme:\n• For Entertainment: Cricket knowledge enhances the experience\n• For Training/Academic: The focus is on strategic decision-making, budget management, and resource allocation - skills applicable to any business context\n• The Learning: Comes from analyzing constraints, competitive bidding, and risk assessment, not cricket expertise\n\nThe platform provides all necessary player information to make informed decisions."
    },
    {
      question: "What happens if I can't complete my team?",
      answer: "The platform has built-in safeguards:\n• Smart Validation: System prevents you from making bids that would leave you unable to complete your team\n• Minimum Requirements: Must have 11 players, 5 bowling options, 1 wicket keeper\n• Budget Protection: Warns you if a bid would violate team completion rules\n• Round 2 Opportunity: Second chance to fill gaps with unsold players\n\nYou cannot accidentally create an illegal team - the system guides you throughout."
    },
    {
      question: "Can we play remotely or does everyone need to be in the same location?",
      answer: "Completely flexible!\n• Remote: Participants join from anywhere with internet connection\n• In-Person: Everyone gathers in one location with their devices\n• Hybrid: Mix of remote and in-person participants\n• Global: Players can join from different cities or countries\n\nThe platform works seamlessly regardless of physical location - perfect for distributed teams or international groups."
    },
    {
      question: "What information do you need from us to set up?",
      answer: "Minimal setup required:\n• Participant Details: Names and email addresses of managers\n• Event Preferences: Date, number of auctions, any special requirements\n• Score Tracking: Whether you want the Score Management package\n• Delivery Address: For trophy shipment (if applicable)\n\nWe handle all technical setup - you just coordinate your participants and show up ready to play!"
    },
    {
      question: "Do you provide training or support during the event?",
      answer: "Yes! Our service includes:\n• Professional Admin: We manage the entire auction for you\n• Pre-Event Brief: Instructions for participants before the event\n• Live Support: Admin available throughout the session\n• Technical Assistance: Help with any platform issues\n• Post-Event: Results compilation and winner announcement\n\nYou don't need any technical expertise - we run everything so you can focus on the experience."
    },
    {
      question: "What if someone disconnects or has technical issues during the auction?",
      answer: "The platform is resilient:\n• Auto-Save: All bids and data saved in real-time\n• Reconnect: Participants can rejoin instantly without losing progress\n• Admin Control: Can pause auction if needed\n• Mobile Backup: Participants can switch devices mid-auction\n• Support Available: Our admin helps resolve issues immediately\n\nThe auction continues smoothly even if individual participants face brief connectivity issues."
    },
    {
      question: "How can I learn more about the platform?",
      answer: "Contact us for information:\n• Email: hello@nbbluestudios.com\n• Website: www.nbbluestudios.com\n• Consultation: Discuss your requirements and how Game of Gambits fits your needs\n\nWe're happy to answer questions about features, pricing, and customization options. Reach out to explore how the platform can work for your event or organization."
    },
    {
      question: "Do I need internet connection?",
      answer: "Yes, Game of Gambits is a cloud-based platform that requires internet connectivity:\n• Stable WiFi or mobile data for all participants\n• Minimum speed: Basic broadband (2-3 Mbps per device)\n• Works on: Any device with a web browser and internet access\n• No downloads: Everything runs online in real-time\n\nFor in-person events, ensure the venue has reliable WiFi. For remote events, participants connect from their own internet."
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)',
      color: 'white',
    }}>
      {/* Hero Section */}
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        position: 'relative',
      }}>
        {/* Host Login Button */}
        <button
          onClick={() => router.push('/login')}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            padding: '10px 30px',
            background: 'white',
            color: '#02084b',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          Host Login
        </button>

        <div style={{
          maxWidth: '1000px',
          textAlign: 'center',
        }}>
          {/* Title */}
          <h1 style={{
            fontSize: '52px',
            marginBottom: '15px',
            fontWeight: 'bold',
            color: '#ffffff',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}>
            ♟️ Game of Gambits
          </h1>
          
          <p style={{
            fontSize: '20px',
            marginBottom: '8px',
            color: 'rgba(255,255,255,0.95)',
            fontWeight: '500',
          }}>
            A Strategic Decision Simulation
          </p>

          <p style={{
            fontSize: '13px',
            marginBottom: '30px',
            color: 'rgba(255,255,255,0.6)',
          }}>
            by NB Blue Studios
          </p>

          <p style={{
            fontSize: '16px',
            marginBottom: '50px',
            color: 'rgba(255,255,255,0.9)',
            lineHeight: '1.6',
            maxWidth: '800px',
            margin: '0 auto 50px',
          }}>
            Experience competitive decision-making through live auction strategy designed for MBA students, corporate teams, and strategic thinkers.
          </p>

          {/* Two Use Cases */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '30px',
            marginBottom: '40px',
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '30px',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            }}>
              <div style={{ fontSize: '42px', marginBottom: '15px' }}>🎪</div>
              <h3 style={{ 
                fontSize: '22px', 
                marginBottom: '12px', 
                fontWeight: 'bold',
                color: '#ffffff',
              }}>
                Entertainment Mode
              </h3>
              <p style={{ 
                fontSize: '14px', 
                marginBottom: '15px',
                color: 'rgba(255,255,255,0.95)',
              }}>
                Live auction experience
              </p>
              <p style={{ 
                fontSize: '12px', 
                color: 'rgba(255,255,255,0.85)',
                lineHeight: '1.6',
              }}>
                Friend circles • Corporate teams • Fun & competition
              </p>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '30px',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            }}>
              <div style={{ fontSize: '42px', marginBottom: '15px' }}>🎓</div>
              <h3 style={{ 
                fontSize: '22px', 
                marginBottom: '12px', 
                fontWeight: 'bold',
                color: '#ffffff',
              }}>
                Academic Simulation
              </h3>
              <p style={{ 
                fontSize: '14px', 
                marginBottom: '15px',
                color: 'rgba(255,255,255,0.95)',
              }}>
                Strategy & budget allocation
              </p>
              <p style={{ 
                fontSize: '12px', 
                color: 'rgba(255,255,255,0.85)',
                lineHeight: '1.6',
              }}>
                MBA programs • Corporate L&D • Decision-making
              </p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '40px' }}>
            <button
              onClick={() => router.push('/login')}
              style={{
                padding: '16px 40px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)',
              }}
            >
              Start Your Simulation →
            </button>
            <button
              onClick={scrollToContact}
              style={{
                padding: '16px 40px',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '2px solid white',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
              }}
            >
              Contact Us
            </button>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        padding: '80px 20px',
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '40px',
            textAlign: 'center',
            marginBottom: '50px',
            fontWeight: 'bold',
          }}>
            How It Works
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '30px',
          }}>
            {[
              { num: '1', title: 'Create', desc: 'Admin sets up the auction session' },
              { num: '2', title: 'Invite', desc: 'Invite participants (up to 12 teams)' },
              { num: '3', title: 'Allocate', desc: 'Strategically invest your points' },
              { num: '4', title: 'Track', desc: 'Monitor performance and rankings' },
            ].map(step => (
              <div key={step.num} style={{
                textAlign: 'center',
                padding: '30px 20px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: '#28a745',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  fontWeight: 'bold',
                  margin: '0 auto 20px',
                }}>
                  {step.num}
                </div>
                <h3 style={{ fontSize: '20px', marginBottom: '10px' }}>{step.title}</h3>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Features */}
      <div style={{
        padding: '80px 20px',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '40px',
            textAlign: 'center',
            marginBottom: '50px',
            fontWeight: 'bold',
          }}>
            Key Features
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '25px',
          }}>
            {[
              { icon: '⚡', title: 'Real-Time Resource Allocation', desc: 'Live bidding with 30-second timer and instant updates' },
              { icon: '🎯', title: 'Multi-Auction Support', desc: 'Run multiple concurrent auctions in a single event' },
              { icon: '📊', title: 'Score Tracking (Optional)', desc: 'Track player performance across real matches' },
              { icon: '🏆', title: 'Winner Recognition', desc: 'Physical trophies and certificates for champions' },
              { icon: '🔒', title: 'Smart Validation', desc: 'System prevents illegal team formations' },
              { icon: '🌐', title: 'Remote & In-Person', desc: 'Play from anywhere or gather in one location' },
            ].map(feature => (
              <div key={feature.title} style={{
                padding: '25px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                display: 'flex',
                gap: '20px',
              }}>
                <div style={{ fontSize: '36px', flexShrink: 0 }}>{feature.icon}</div>
                <div>
                  <h3 style={{ fontSize: '17px', marginBottom: '8px', fontWeight: 'bold' }}>
                    {feature.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.5' }}>
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing Preview */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        padding: '80px 20px',
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{
            fontSize: '40px',
            marginBottom: '20px',
            fontWeight: 'bold',
          }}>
            Simple Pricing
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.8)',
            marginBottom: '40px',
          }}>
            Ideal for MBA workshops, corporate simulations, and team events
          </p>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '40px',
            borderRadius: '12px',
            marginBottom: '30px',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '30px',
              marginBottom: '30px',
            }}>
              <div>
                <h3 style={{ fontSize: '24px', marginBottom: '15px' }}>Basic Auction</h3>
                <div style={{ fontSize: '40px', fontWeight: 'bold', marginBottom: '10px' }}>
                  ₹7,500
                </div>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
                  per auction event
                </p>
              </div>
              <div>
                <h3 style={{ fontSize: '24px', marginBottom: '15px' }}>With Score Management</h3>
                <div style={{ fontSize: '40px', fontWeight: 'bold', marginBottom: '10px' }}>
                  +₹5,000
                </div>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
                  per event (includes trophies)
                </p>
              </div>
            </div>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginBottom: '20px' }}>
              Example: 10 participants = ₹750 per person<br/>
              Multiple auctions available in one event
            </p>
            <button
              onClick={() => {
                const faqEl = document.getElementById('faq');
                faqEl?.scrollIntoView({ behavior: 'smooth' });
                setTimeout(() => setExpandedFAQ(5), 500);
              }}
              style={{
                padding: '12px 30px',
                background: 'white',
                color: '#02084b',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              See Full Pricing Details →
            </button>
          </div>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
            Custom pricing available for academic and corporate clients
          </p>
        </div>
      </div>

      {/* FAQ Section */}
      <div id="faq" style={{
        padding: '80px 20px',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '40px',
            textAlign: 'center',
            marginBottom: '50px',
            fontWeight: 'bold',
          }}>
            Frequently Asked Questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {faqs.map((faq, index) => (
              <div
                key={index}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  style={{
                    width: '100%',
                    padding: '20px',
                    background: 'transparent',
                    color: 'white',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{faq.question}</span>
                  <span style={{ fontSize: '20px' }}>
                    {expandedFAQ === index ? '−' : '+'}
                  </span>
                </button>
                {expandedFAQ === index && (
                  <div style={{
                    padding: '0 20px 20px 20px',
                    fontSize: '14px',
                    lineHeight: '1.8',
                    color: 'rgba(255,255,255,0.9)',
                    whiteSpace: 'pre-line',
                  }}>
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contact Form */}
      <div id="contact" style={{
        background: 'rgba(255,255,255,0.05)',
        padding: '80px 20px',
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '40px',
            textAlign: 'center',
            marginBottom: '20px',
            fontWeight: 'bold',
          }}>
            Get in Touch
          </h2>
          <p style={{
            textAlign: 'center',
            fontSize: '16px',
            color: 'rgba(255,255,255,0.8)',
            marginBottom: '40px',
          }}>
            Interested in Game of Gambits for your organization or event?
          </p>

          {formSubmitted ? (
            <div style={{
              background: '#28a745',
              padding: '30px',
              borderRadius: '12px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>✓</div>
              <h3 style={{ fontSize: '24px', marginBottom: '10px' }}>Thank You!</h3>
              <p style={{ fontSize: '14px' }}>
                We've received your inquiry and will get back to you soon.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '40px',
              borderRadius: '12px',
            }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.95)',
                  fontWeight: '500',
                }}>
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.12)',
                    color: 'white',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.95)',
                  fontWeight: '500',
                }}>
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.12)',
                    color: 'white',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.95)',
                  fontWeight: '500',
                }}>
                  Organization
                </label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData({...formData, organization: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.12)',
                    color: 'white',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.95)',
                  fontWeight: '500',
                }}>
                  Event Type
                </label>
                <select
                  value={formData.eventType}
                  onChange={(e) => setFormData({...formData, eventType: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.12)',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  <option value="" style={{ background: '#02084b' }}>Select...</option>
                  <option value="entertainment" style={{ background: '#02084b' }}>Entertainment</option>
                  <option value="academic" style={{ background: '#02084b' }}>Academic</option>
                  <option value="corporate" style={{ background: '#02084b' }}>Corporate</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.95)',
                  fontWeight: '500',
                }}>
                  Number of Participants
                </label>
                <input
                  type="text"
                  value={formData.participants}
                  onChange={(e) => setFormData({...formData, participants: e.target.value})}
                  placeholder="e.g., 10-12"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.12)',
                    color: 'white',
                  }}
                />
              </div>

              <div style={{ marginBottom: '30px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.95)',
                  fontWeight: '500',
                }}>
                  Message *
                </label>
                <textarea
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    background: 'rgba(255,255,255,0.12)',
                    color: 'white',
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '16px',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                }}
              >
                Send Inquiry →
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: '40px 20px',
        background: 'rgba(0,0,0,0.2)',
        color: 'rgba(255,255,255,0.8)',
      }}>
        <p style={{ marginBottom: '10px', fontSize: '14px' }}>
          Powered by{' '}
          <a 
            href="https://www.nbbluestudios.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'white',
              fontWeight: 'bold',
              textDecoration: 'none',
              borderBottom: '1px solid white',
            }}
          >
            NB Blue Studios
          </a>
        </p>
        <p style={{ fontSize: '12px' }}>
          Contact: hello@nbbluestudios.com
        </p>
      </div>
    </div>
  );
}