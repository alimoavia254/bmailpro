// app/unsubscribe/confirmed/page.tsx
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

export default function UnsubscribeConfirmedPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50 dark:bg-zinc-950">
            <div className="max-w-md w-full text-center space-y-6 bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 animate-in fade-in zoom-in duration-300">
                <div className="flex justify-center">
                    <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full">
                        <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                        Unsubscribed Successfully
                    </h1>
                    <p className="text-gray-500 dark:text-zinc-400">
                        You have been removed from our mailing list. You will no longer receive marketing emails from this sender.
                    </p>
                </div>

                <div className="pt-4">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center px-6 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        Go to BMail Pro
                    </Link>
                </div>

                <div className="pt-6 border-t border-gray-100 dark:border-zinc-800">
                    <p className="text-xs text-gray-400 dark:text-zinc-500">
                        If you unsubscribed by mistake or want to resubscribe later, please contact the sender directly.
                    </p>
                </div>
            </div>
        </div>
    )
}
