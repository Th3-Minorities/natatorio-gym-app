<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Authorization;
use App\Services\UserAccountDeletion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UserAccountController extends Controller
{
    public function me(Request $request): JsonResponse
    {
        $user = $request->user('web');

        return response()->json($user->profile());
    }

    public function photo(Request $request): StreamedResponse
    {
        $path = Authorization::query()->where('user_id', $request->user('web')->id)
            ->orderByDesc('id')->value('photo_path');
        if (! $path || ! Storage::disk('local')->exists($path)) {
            throw new ApiException('not_found', 404);
        }

        return Storage::disk('local')->response($path, null, ['Cache-Control' => 'private, no-store']);
    }

    public function locale(Request $request): JsonResponse
    {
        $input = $request->validate(['locale' => ['required', 'string', 'in:es,en']]);
        $request->user('web')->update($input);

        return $this->me($request);
    }

    public function delete(Request $request): Response
    {
        app(UserAccountDeletion::class)->delete($request->user('web'));
        Auth::guard('web')->logoutCurrentDevice();
        $request->session()->forget('user_session_id');
        $request->session()->regenerate(destroy: true);
        $request->session()->regenerateToken();

        return response()->noContent();
    }
}
