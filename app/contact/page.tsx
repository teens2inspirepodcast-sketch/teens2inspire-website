import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
export const metadata: Metadata = { title: "Contact", description: "Get in touch with the Teens2Inspire team." };
export default function ContactPage() { return <div className="form-page page-shell"><div className="form-aside"><span className="eyebrow eyebrow-line">We’re listening</span><h1>Say <em>hello.</em></h1><p>Have a question, an idea, or something you’d love to share? We’d love to hear from you.</p><span className="form-aside-mark">✳</span></div><div className="form-panel"><h2>Drop us a note</h2><p>We’ll get back to you as soon as we can.</p><ContactForm/></div></div>; }
