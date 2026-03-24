'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, ShieldCheck, Zap, CreditCard, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const PLANS = [
    {
        name: 'Free',
        price: '$0',
        description: 'Perfect for getting started',
        features: [
            '1,000 emails per month',
            'Basic analytics',
            '1 SMTP slot',
            'Community support'
        ],
        buttonText: 'Current Plan',
        current: true,
    },
    {
        name: 'Pro',
        price: '$19',
        period: '/month',
        description: 'For growing businesses',
        features: [
            'Unlimited emails',
            'Advanced A/B testing',
            '2 SMTP slots',
            'Real-time webhooks',
            'CSV batch import',
            'Priority support'
        ],
        buttonText: 'Upgrade to Pro',
        current: false,
        highlight: true,
    }
]

export default function BillingPage() {
    const [loading, setLoading] = useState(false)

    return (
        <div className="max-w-5xl mx-auto space-y-12 py-8">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">Simple, Transparent Pricing</h1>
                <p className="text-xl text-muted-foreground mx-auto max-w-2xl">
                    Choose the plan that's right for your business. No hidden fees, ever.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {PLANS.map((plan) => (
                    <Card key={plan.name} className={`relative overflow-hidden border-2 h-full flex flex-col ${plan.highlight ? 'border-primary shadow-xl scale-105 z-10' : 'border-border'}`}>
                        {plan.highlight && (
                            <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 rounded-bl-lg font-bold text-xs">
                                MOST POPULAR
                            </div>
                        )}
                        <CardHeader className="text-center pb-2">
                            <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                            <CardDescription>{plan.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-6">
                            <div className="text-center">
                                <span className="text-5xl font-extrabold">{plan.price}</span>
                                {plan.period && <span className="text-muted-foreground ml-1">{plan.period}</span>}
                            </div>

                            <div className="space-y-4">
                                {plan.features.map((feature) => (
                                    <div key={feature} className="flex items-center gap-3">
                                        <div className="bg-primary/10 p-1 rounded-full">
                                            <Check className="w-3 h-3 text-primary" />
                                        </div>
                                        <span className="text-sm">{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                        <CardFooter className="pt-6 pb-8">
                            <Button
                                variant={plan.highlight ? 'default' : 'outline'}
                                className="w-full h-12 text-lg font-bold"
                                disabled={plan.current || loading}
                            >
                                {plan.buttonText}
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            <div className="bg-muted/30 rounded-3xl p-8 border border-border/50 text-center space-y-8">
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-primary" />
                        Secure Payments Guaranteed
                    </h2>
                    <p className="text-muted-foreground">We partner with the world's most trusted payment processors.</p>
                </div>

                <div className="flex flex-wrap justify-center gap-12 opacity-80">
                    <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all cursor-default">
                        <CreditCard className="w-8 h-8" />
                        <span className="text-xl font-bold tracking-tight">Stripe</span>
                    </div>
                    <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all cursor-default">
                        <Wallet className="w-8 h-8" />
                        <span className="text-xl font-bold tracking-tight">JazzCash</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 text-left">
                    <div className="space-y-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="font-bold">Instant Activation</h3>
                        <p className="text-xs text-muted-foreground">Get access to Pro features immediately after payment.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="font-bold">Secure Transactions</h3>
                        <p className="text-xs text-muted-foreground">Your payment data is fully encrypted and never stored on our servers.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="font-bold">Flexible Billing</h3>
                        <p className="text-xs text-muted-foreground">Upgrade or downgrade your plan at any time with ease.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
