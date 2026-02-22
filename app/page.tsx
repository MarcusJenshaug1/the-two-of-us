import { redirect } from 'next/navigation'

export default function Home() {
    // Middleware handles auth + room checks
    redirect('/app/questions')
}
