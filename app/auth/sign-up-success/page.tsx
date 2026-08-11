import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SignUpSuccessPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Kiểm tra email để xác thực</CardTitle>
          <CardDescription>
            Chúng tôi đã gửi một liên kết xác thực đến email của bác. Sau khi bấm vào, bác có thể
            đăng nhập vào hệ thống.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/auth/login">Quay lại đăng nhập</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
