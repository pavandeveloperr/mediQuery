import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center 
                     justify-center p-8">
      <h1 className="text-4xl font-medium text-gray-900 mb-4">
        MediQuery
      </h1>
      <p className="text-gray-500 text-lg text-center max-w-md">
        Ask questions about your medical documents. 
        Powered by AI. Grounded in your data.
      </p>
      
      <Link href="/dashboard" className="mt-8 px-6 py-3 bg-gray-900 text-white 
                   rounded-lg text-sm font-medium hover:bg-gray-700">
        Get started
      </Link>
    </main>
  )
}