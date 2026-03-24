'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Upload } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Contact {
  id: string
  email: string
  name: string | null
  created_at: string
  tags?: Tag[]
}

interface Tag {
  id: string
  name: string
  color: string
}

export default function ContactsPage() {
  const supabase = createClient()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [newContact, setNewContact] = useState({ email: '', name: '' })
  const [bulkEmails, setBulkEmails] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [newTagName, setNewTagName] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        // Fetch Tags
        const { data: tagsData } = await supabase
          .from('tags')
          .select('*')
          .eq('user_id', user.id)
        if (tagsData) setTags(tagsData)

        // Fetch Contacts with Tags via junction table
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('*, contact_tags(tags(*))')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (contactsData) {
          const formatted = contactsData.map(c => ({
            ...c,
            tags: c.contact_tags?.map((ct: any) => ct.tags).filter(Boolean) || []
          }))
          setContacts(formatted)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase])

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContact.email) return

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      const { data } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          email: newContact.email,
          name: newContact.name || null,
        })
        .select()
        .single()

      if (data) {
        setContacts([data, ...contacts])
        setNewContact({ email: '', name: '' })
      }
    } catch (error) {
      console.error('Error adding contact:', error)
      alert('Failed to add contact')
    }
  }

  const handleBulkAdd = async () => {
    if (!bulkEmails) return

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      const emails = bulkEmails
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && line.includes('@'))

      const { data } = await supabase
        .from('contacts')
        .insert(
          emails.map((email) => ({
            user_id: user.id,
            email,
            name: null,
          }))
        )
        .select()

      if (data) {
        setContacts([...data, ...contacts])
        setBulkEmails('')
        alert(`Added ${data.length} contacts`)
      }
    } catch (error) {
      console.error('Error bulk adding contacts:', error)
      alert('Failed to add contacts')
    }
  }

  const handleDelete = async (contactId: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      try {
        await supabase.from('contacts').delete().eq('id', contactId)
        setContacts(contacts.filter((c) => c.id !== contactId))
      } catch (error) {
        console.error('Error deleting contact:', error)
      }
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading contacts...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Contacts</h1>
        <p className="text-muted-foreground mt-2">Manage your email contacts</p>
      </div>

      <Tabs defaultValue="single" className="space-y-4">
        <TabsList>
          <TabsTrigger value="single">Add Single Contact</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
          <TabsTrigger value="csv">CSV Import</TabsTrigger>
          <TabsTrigger value="tags">Manage Tags</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Add Contact</CardTitle>
              <CardDescription>Add a single contact to your list</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddContact} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="name">Name (Optional)</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  />
                </div>
                <Button type="submit" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Contact
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="csv">
          <Card>
            <CardHeader>
              <CardTitle>CSV Import</CardTitle>
              <CardDescription>Upload a CSV file with columns: email, name</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="csv_file">Select CSV File</Label>
                <div className="flex gap-2">
                  <Input
                    id="csv_file"
                    type="file"
                    accept=".csv"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return

                      const reader = new FileReader()
                      reader.onload = async (event) => {
                        const csv = event.target?.result as string
                        const lines = csv.split('\n')
                        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())

                        const emailIdx = headers.indexOf('email')
                        const nameIdx = headers.indexOf('name')

                        if (emailIdx === -1) {
                          alert('CSV must have an "email" column')
                          return
                        }

                        const { data: { user } } = await supabase.auth.getUser()
                        if (!user) return

                        const contactsToImport = lines.slice(1)
                          .map((line) => {
                            const values = line.split(',').map((v) => v.trim())
                            if (values.length <= emailIdx) return null
                            const email = values[emailIdx]
                            if (!email || !email.includes('@')) return null
                            return {
                              user_id: user.id,
                              email,
                              name: nameIdx !== -1 ? values[nameIdx] || null : null
                            }
                          })
                          .filter(Boolean) as any[]

                        if (contactsToImport.length > 0) {
                          const { data, error } = await supabase
                            .from('contacts')
                            .upsert(contactsToImport, { onConflict: 'user_id,email' })
                            .select()

                          if (error) {
                            alert('Error importing contacts: ' + error.message)
                          } else {
                            setContacts([...(data || []), ...contacts])
                            alert(`Successfully imported ${data?.length} contacts!`)
                          }
                        }
                      }
                      reader.readAsText(file)
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Format: email,name (e.g. john@example.com,John Doe)
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tags">
          <Card>
            <CardHeader>
              <CardTitle>Manage Tags</CardTitle>
              <CardDescription>Create and organize tags for your contacts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="New tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                />
                <Button onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser()
                  if (!user || !newTagName) return
                  const { data } = await supabase.from('tags').insert({ user_id: user.id, name: newTagName }).select().single()
                  if (data) {
                    setTags([...tags, data])
                    setNewTagName('')
                  }
                }}>Add Tag</Button>
              </div>
              <div className="flex flex-wrap gap-2 pt-4">
                {tags.map(tag => (
                  <div key={tag.id} className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full text-sm">
                    <span style={{ color: tag.color }}>{tag.name}</span>
                    <button onClick={async () => {
                      if (confirm(`Delete tag "${tag.name}"?`)) {
                        await supabase.from('tags').delete().eq('id', tag.id)
                        setTags(tags.filter(t => t.id !== tag.id))
                      }
                    }} className="hover:text-red-500 font-bold ml-1">×</button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-4 py-2">
        <Label className="text-sm font-medium">Filter by Tag:</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedTag === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTag(null)}
          >
            All
          </Button>
          {tags.map(tag => (
            <Button
              key={tag.id}
              variant={selectedTag === tag.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTag(tag.id)}
              className="rounded-full"
            >
              {tag.name}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Contacts ({contacts.filter(c => !selectedTag || c.tags?.some(t => t.id === selectedTag)).length})</CardTitle>
          <CardDescription>All contacts in your address book</CardDescription>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No contacts yet</p>
          ) : (
            <div className="space-y-4">
              {contacts
                .filter(c => !selectedTag || c.tags?.some(t => t.id === selectedTag))
                .map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent transition-colors group"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{contact.email}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {contact.name && (
                          <div className="text-xs text-muted-foreground mr-2">{contact.name}</div>
                        )}
                        {contact.tags?.map(tag => (
                          <span key={tag.id} className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800">
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        className="text-xs bg-transparent border-none focus:ring-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        onChange={async (e) => {
                          const tagId = e.target.value
                          if (!tagId) return

                          // Check if already has tag
                          if (contact.tags?.some(t => t.id === tagId)) return

                          await supabase.from('contact_tags').insert({
                            contact_id: contact.id,
                            tag_id: tagId
                          })

                          // Refresh contact data
                          const newTag = tags.find(t => t.id === tagId)
                          if (newTag) {
                            setContacts(contacts.map(c =>
                              c.id === contact.id
                                ? { ...c, tags: [...(c.tags || []), newTag] }
                                : c
                            ))
                          }
                          e.target.value = ""
                        }}
                      >
                        <option value="">Apply Tag...</option>
                        {tags.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleDelete(contact.id)}
                        className="text-muted-foreground hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
