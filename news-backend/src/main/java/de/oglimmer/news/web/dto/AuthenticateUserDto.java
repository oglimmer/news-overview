package de.oglimmer.news.web.dto;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Getter
@Setter
@ToString
public class AuthenticateUserDto {
    private String email;
    private String password;
}
