'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCampaign } from '@/app/actions/campaigns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Box, Eye, Split } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'

interface Template {
  id: string
  name: string
  subject: string
  html_content: string
}

export default function NewCampaignPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body_html: '',
    scheduled_at: '',
    is_ab_test: false,
    subject_b: '',
    body_html_b: '',
  })
  const [templates, setTemplates] = useState<Template[]>([])

  const supabase = createClient()

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase.from('templates').select('*')
      if (data) setTemplates(data)
    }
    fetchTemplates()
  }, [supabase])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await createCampaign({
        name: formData.name,
        subject: formData.subject,
        body_html: formData.body_html,
        scheduled_at: formData.scheduled_at || null,
        status: formData.scheduled_at ? 'scheduled' : 'draft',
        is_ab_test: formData.is_ab_test,
        variants: formData.is_ab_test ? [
          { name: 'Variant A', subject: formData.subject, body_html: formData.body_html },
          { name: 'Variant B', subject: formData.subject_b, body_html: formData.body_html_b }
        ] : []
      })

      if (result.error) {
        setError(result.error)
        return
      }

      if (result.data) {
        router.push(`/protected/campaigns/${result.data.id}`)
      }
    } catch (err) {
      setError('Failed to create campaign')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/protected/campaigns" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" />
        Back to Campaigns
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Create New Campaign</CardTitle>
          <CardDescription>Set up your email campaign</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Summer Sale 2024"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="flex items-center space-x-2 p-4 bg-muted/50 rounded-lg border border-dashed border-primary/30">
              <Split className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <Label htmlFor="is_ab_test" className="font-semibold text-sm">Enable A/B Testing</Label>
                <div className="text-[10px] text-muted-foreground italic">Compare two versions for better engagement.</div>
              </div>
              <Switch
                id="is_ab_test"
                checked={formData.is_ab_test}
                onCheckedChange={(checked) => setFormData({ ...formData, is_ab_test: checked })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  Variant A {formData.is_ab_test && '(Control)'}
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="subject" className="text-xs">Email Subject A</Label>
                    <Input id="subject" name="subject" value={formData.subject} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="body_html" className="text-xs">Email Body A (HTML)</Label>
                    <Textarea id="body_html" name="body_html" value={formData.body_html} onChange={handleInputChange} required rows={10} className="font-mono text-xs" />
                  </div>
                </div>
              </div>

              {formData.is_ab_test && (
                <div className="space-y-4 p-4 border rounded-lg bg-card shadow-sm border-primary/20">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    Variant B (Test)
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="subject_b" className="text-xs">Email Subject B</Label>
                      <Input id="subject_b" name="subject_b" value={formData.subject_b} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="body_html_b" className="text-xs">Email Body B (HTML)</Label>
                      <Textarea id="body_html_b" name="body_html_b" value={formData.body_html_b} onChange={handleInputChange} required rows={10} className="font-mono text-xs" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <Label className="text-sm">Or Choose a Template to Populate Variant A</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="cursor-pointer border border-border rounded-lg p-3 hover:border-primary transition-colors hover:bg-accent text-center"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        subject: template.subject,
                        body_html: template.html_content,
                      }))
                    }}
                  >
                    <Box className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                    <div className="font-medium text-[10px]">{template.name}</div>
                  </div>
                ))}
              </div>
            </div>


            <div className="space-y-2">
              <Label htmlFor="scheduled_at">Schedule for later (Optional)</Label>
              <Input
                id="scheduled_at"
                name="scheduled_at"
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={handleInputChange}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to save as draft.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Campaign'}
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" className="gap-2">
                    <Eye className="w-4 h-4" />
                    Preview
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Email Preview</DialogTitle>
                  </DialogHeader>
                  <div className="border rounded-lg p-6 bg-white min-h-[400px]">
                    <div className="mb-4 pb-4 border-b">
                      <div className="text-sm font-semibold">Subject: {formData.subject}</div>
                    </div>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: formData.body_html.replace(/\{\{name\}\}/g, 'John Doe').replace(/\{\{email\}\}/g, 'john@example.com')
                      }}
                    />
                  </div>
                </DialogContent>
              </Dialog>
              <Link href="/protected/campaigns">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
