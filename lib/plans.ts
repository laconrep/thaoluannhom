export type Plan = "free" | "pro" | "school"

export const PLANS: {
  id: Plan
  name: string
  price: string
  period: string
  tagline: string
  highlight?: boolean
  limits: { maxClasses: number; maxStudentsPerClass: number; maxPresentations: number }
  features: string[]
}[] = [
  {
    id: "free",
    name: "Miễn phí",
    price: "0",
    period: "đ/tháng",
    tagline: "Dùng thử cho một lớp",
    limits: { maxClasses: 3, maxStudentsPerClass: 40, maxPresentations: 20 },
    features: [
      "Tối đa 3 lớp học",
      "Tối đa 40 học sinh / lớp",
      "Phiên nhóm & cá nhân không giới hạn",
      "Chấm bài trực tiếp trên ảnh/file",
      "Bảng điểm + xuất CSV",
    ],
  },
  {
    id: "pro",
    name: "Giáo viên",
    price: "49.000",
    period: "đ/tháng",
    tagline: "Dành cho giáo viên dùng thường xuyên",
    highlight: true,
    limits: { maxClasses: 30, maxStudentsPerClass: 80, maxPresentations: 100 },
    features: [
      "Tối đa 30 lớp học",
      "Tối đa 80 học sinh / lớp",
      "Mọi tính năng của gói Miễn phí",
      "Nhập danh sách HS từ Excel/CSV",
      "Tạo mã QR lớp học",
      "Hỗ trợ ưu tiên qua email",
    ],
  },
  {
    id: "school",
    name: "Trường học",
    price: "Liên hệ",
    period: "",
    tagline: "Dành cho trường / tổ bộ môn",
    limits: { maxClasses: Infinity, maxStudentsPerClass: 200, maxPresentations: Infinity },
    features: [
      "Không giới hạn lớp học",
      "Tối đa 200 học sinh / lớp",
      "Quản lý nhiều giáo viên",
      "Báo cáo thống kê toàn trường",
      "Hỗ trợ triển khai tận nơi",
    ],
  },
]

export const PLAN_DEFAULT: Plan = "free"

export function planLimits(plan: Plan) {
  return PLANS.find((p) => p.id === plan)?.limits ?? PLANS[0].limits
}
