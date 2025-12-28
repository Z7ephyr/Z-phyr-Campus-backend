export class AuthResponseDto {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    student_id: string;
    email: string;
    role: string;
    full_name: string;
  };
}