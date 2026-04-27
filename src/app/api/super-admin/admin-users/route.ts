import { NextResponse } from 'next/server'

export async function GET() {
	return NextResponse.json(
		{
			success: false,
			message: 'Admin users endpoint is not implemented yet.',
		},
		{ status: 501 }
	)
}
