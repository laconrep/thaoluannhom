import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Lỗi xác thực</CardTitle>
          <CardDescription>
            Có lỗi xảy ra trong quá trình xác thực. Vui lòng thử lại.
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
